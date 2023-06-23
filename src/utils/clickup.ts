import { Task, Space, Template, CustomField } from '../models/clickup';
import { CLICKUP_API_URL } from '../models/constants';
import { Issue, IssueId, IssueQueue, ReleaseStrategy } from '../models/strategy';
import {
    CLICKUP_API_TOKEN,
    LIST_ID,
    PLATFORM,
    TAG,
    SHOULD_SKIP_CIRCLECI_CHECKS,
    REGRESSION_TESTING_TEMPLATE_ID,
    RELEASE_TAGS_LIST_ID,
    CIRCLECI_BRANCH,
    CIRCLECI_WORKFLOW_NAME,
    MERGE_DELAY,
    FIRST_MERGE_DELAY,
} from './config';
import github from './github';
import logger from './logger';
import { IssueError, IssueErrorType } from '../models/error';
import circleci from './circleci';
import { UpdateIssueParams } from '../models/clickup';
import Http from './http';

export class Clickup implements ReleaseStrategy {
    issues_queue: IssueQueue;
    http: Http;

    constructor() {
        this.issues_queue = new IssueQueue();
        this.http = new Http(CLICKUP_API_URL, {
            headers: {
                Authorization: CLICKUP_API_TOKEN,
            },
        });
    }

    async fetchIssue(issue_id: IssueId): Promise<Issue> {
        const task = await this.http.get<Task>(`task/${issue_id}`);

        let pull_request: string | undefined = github.getGitHubPR(task.description);
        if (pull_request.length === 0) {
            // if there is no pull request in description, try fetching it in the custom fields
            const pull_request_field = task.custom_fields?.find(field => field.name === 'Pull Request');
            if (pull_request_field && pull_request_field.value) {
                pull_request = pull_request_field.value;
            } else {
                pull_request = undefined;
            }
        }

        return {
            id: task.id,
            title: task.name,
            description: task.description,
            status: task.status.status,
            pull_request,
            assignees: task.assignees.map(assignee => {
                return {
                    id: assignee.id,
                    name: assignee.username,
                    email: assignee.email,
                };
            }),
        };
    }

    async updateIssue(issue_id: IssueId, details: Partial<UpdateIssueParams>) {
        await this.http.put(`task/${issue_id}`, {
            ...details,
        });
    }

    async fetchIssues(list_id: IssueId, status?: string): Promise<Issue[]> {
        const { tasks } = await this.http.get<{ tasks: Task[] }>(
            `list/${list_id}/task${status ? `?statuses[]=${status}&order_by=updated&reverse=true` : ''}`
        );
        return tasks.map(task => {
            let pull_request: string | undefined = github.getGitHubPR(task.description);
            if (pull_request.length === 0) {
                // if there is no pull request in description, try fetching it in the custom fields
                const pull_request_field = task.custom_fields?.find(field => field.name === 'Pull Request');
                if (pull_request_field && pull_request_field.value) {
                    pull_request = pull_request_field.value;
                } else {
                    pull_request = undefined;
                }
            }

            return {
                id: task.id,
                title: task.name,
                description: task.description,
                status: task.status.status,
                assignees: task.assignees?.length
                    ? task.assignees.map(assignee => {
                          return {
                              id: assignee.id,
                              name: assignee.username,
                              email: assignee.email,
                          };
                      })
                    : undefined,
                pull_request,
                custom_fields: task.custom_fields,
            };
        });
    }

    async getSpace(space_id: string): Promise<Space> {
        const space = await this.http.get<Space>(`space/${space_id}`);
        return space;
    }

    async mergeCards(): Promise<[Issue[], IssueError[]]> {
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const failed_issues: IssueError[] = [];
        const merged_issues: Issue[] = [];
        const cards_count = this.issues_queue.getAllIssues().length;
        let is_merging_first_card = true;

        while (!this.issues_queue.is_empty) {
            const issue = this.issues_queue.dequeue() as Issue;
            try {
                if (issue.pull_request) {
                    const pr_id = github.getGitHubPRId(issue.pull_request);
                    logger.log(`Merging ${issue.title}...`, 'loading');
                    await github.mergePR(parseInt(pr_id), issue.id);
                    logger.log(`${issue.title} has been successfully merged!`, 'success');
                    logger.log(`Updating card status to Merged - Release...`, 'loading');
                    await this.updateIssue(issue.id, {
                        status: 'Merged - Release',
                    });

                    if (is_merging_first_card) {
                        logger.log(
                            `Merging the first card, waiting ${
                                FIRST_MERGE_DELAY / 60000
                            } minutes for build to finish...`,
                            'loading'
                        );
                        await sleep(FIRST_MERGE_DELAY);
                        is_merging_first_card = false;
                    } else {
                        logger.log(`Waiting ${MERGE_DELAY / 60000} minutes for build to finish...`, 'loading');
                        await sleep(MERGE_DELAY);
                    }

                    if (!SHOULD_SKIP_CIRCLECI_CHECKS) {
                        logger.log(
                            `Checking ${CIRCLECI_WORKFLOW_NAME} pipeline in CircleCI for ${CIRCLECI_BRANCH} branch...`,
                            'loading'
                        );
                        await circleci.checkPipelineStatus(cards_count);
                        logger.log(
                            `CircleCI workflow checks completed for ${CIRCLECI_BRANCH} branch, there are no failing workflows, everything looks great!`,
                            'success'
                        );
                    } else {
                        logger.log('Skipping CircleCI release workflow checks based on settings...');
                    }
                    merged_issues.push(issue);
                } else {
                    throw new IssueError(IssueErrorType.NEEDS_PULL_REQUEST, issue, issue.assignees);
                }
            } catch (err) {
                if (err instanceof Error) {
                    logger.log(`Unable to merge ${issue.title}: ${err.message}`, 'error');
                    if (err instanceof IssueError) {
                        err.assignees = issue.assignees;
                        err.issue = issue;
                        if (err.type === IssueErrorType.FAILED_WORKFLOW) {
                            logger.log(
                                `${CIRCLECI_WORKFLOW_NAME} pipeline in CircleCI has failed, release workflow will stop immediately.`,
                                'error'
                            );
                            break;
                        }
                        failed_issues.push(err);
                    } else {
                        console.log(err);
                    }
                }
            }
        }

        return [merged_issues, failed_issues];
    }

    async createVersion(tag: string): Promise<Issue> {
        const tasks = await this.fetchIssues(RELEASE_TAGS_LIST_ID);
        const title = `${PLATFORM} production_${tag}`;
        const has_release_tag_task = tasks.some(task => task.title === title);
        let release_tag_task: Issue;

        if (!has_release_tag_task) {
            logger.log(`Creating version ${PLATFORM} production_${tag}...`, 'loading');
            release_tag_task = await this.createIssue(title, RELEASE_TAGS_LIST_ID);
        } else {
            logger.log(`Release tag card has already been created.`, 'success');
            release_tag_task = tasks.find(task => task.title === title) as Issue;
        }
        return release_tag_task;
    }

    async addVersionToTask(task: Issue, version: Issue) {
        const version_field = task.custom_fields?.find(field =>
            ['release tags', 'release tag'].includes(field?.name.toLowerCase())
        );

        if (version_field && version_field.id) {
            await this.http.post(`task/${task.id}/field/${version_field.id}`, {
                value: {
                    add: [version.id],
                },
            });
        } else {
            logger.log(
                'Could not find Release Tag/Release Tags field, linking this task as a relationship instead.',
                'loading'
            );
            await this.addTaskRelationship(task.id, version.id);
        }
    }

    async addTaskRelationship(task_id: string, task_to_link_id: string) {
        const task = await this.http.post<Task>(`task/${task_id}/link/${task_to_link_id}`, {});

        return task;
    }

    async getTemplates(space_id: string): Promise<Template[]> {
        const templates = await this.http.get<Template[]>(`team/${space_id}/taskTemplate?page=0`);

        return templates;
    }

    async createIssue(title: string, list_id: string): Promise<Issue> {
        const task = await this.http.post<Task>(`list/${list_id}/task`, {
            name: title,
        });

        return {
            id: task.id,
            title: task.name,
            description: task.description,
            status: task.status.status,
        };
    }

    async createRegressionTestingIssue(version: Issue): Promise<Issue> {
        const title = `${PLATFORM} Regression Tag - ${TAG}`;
        const tasks = await this.fetchIssues(LIST_ID);
        const has_regression_testing_card = tasks.some(task => task.title === title);
        let regression_testing_card: Issue;

        if (!has_regression_testing_card) {
            // If regression testing card doesn't exist, create it
            logger.log(`Creating regression testing card with title ${title}...`, 'loading');
            const task = await this.http.post<Task>(`list/${LIST_ID}/taskTemplate/${REGRESSION_TESTING_TEMPLATE_ID}`, {
                name: title,
            });
            await this.updateIssue(task.id, {
                status: 'Pending - QA',
            });
            regression_testing_card = {
                id: task.id,
                title: task.name,
                description: task.description,
                status: 'Pending - QA',
            };
        } else {
            logger.log(`Regression testing card has already been created.`, 'success');
            regression_testing_card = tasks.find(task => task.title === title) as Issue;
        }

        logger.log('Linking regression testing card to release tag...', 'loading');
        await this.addTaskRelationship(regression_testing_card.id, version.id);
        return regression_testing_card;
    }
    async fetchTasksFromReleaseTagTask(RELEASE_TAG_TASK_URL: string): Promise<Issue[]> {
        const issues: Issue[] = [];
        const task_id = RELEASE_TAG_TASK_URL.split('/').pop();
        const task = await this.http.get<Task>(`task/${task_id}`);
        const { custom_fields } = task;
        const task_ids = this.getTasksIdsFromCustomFields(custom_fields);
        for (const task_id of task_ids) {
            const task = await this.fetchIssue(task_id);
            issues.push(task);
        }

        return issues;
    }
    getTasksIdsFromCustomFields(custom_fields?: CustomField[]): string[] {
        const taskIds: string[] = [];
        for (const custom_field of custom_fields ?? []) {
            if (
                custom_field.value &&
                custom_field.value.length > 0 &&
                custom_field.type === 'list_relationship' &&
                Array.isArray(custom_field.value)
            ) {
                custom_field.value.forEach(value => {
                    if (value.id) {
                        taskIds.push(value.id);
                    }
                });
            }
        }

        return taskIds;
    }
}

export default new Clickup();
