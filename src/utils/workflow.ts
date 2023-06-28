import { Issue, ReleaseStrategyType } from '../models/strategy';
import clickup from './clickup';
import slack from './slack';
import { loadUserHasFailedIssuesMsg } from './slack/messages';
import { IssueError } from 'models/error';
import logger from './logger';
import { MAX_TASK_COUNT, PLATFORM, RELEASE_TAG_TASK_URL, SHOULD_SKIP_SLACK_INTEGRATION } from './config';
import { SlackUser } from 'models/slack';
import { CLICKUP_STATUSES } from 'models/constants';

export class ReleaseWorkflow {
    strategy: ReleaseStrategyType;

    constructor() {
        this.strategy = clickup;
    }

    logSummary(merged_issues: Issue[], failed_issues: IssueError[], failed_notifications: IssueError[]) {
        if (merged_issues.length !== 0) {
            logger.log('Cards that were merged successfully:');
            const rows: { [title: string]: { 'Pull Request': string } } = {};
            merged_issues.forEach(issue => {
                if (issue.pull_request) {
                    rows[issue.title] = {
                        'Pull Request': issue.pull_request,
                    };
                }
            });
            console.table(rows);
        }
        if (failed_issues.length !== 0) {
            logger.log('Cards that failed to be merged:');
            const rows: { [title: string]: { Reason: string; 'Assignee notified': boolean } } = {};
            failed_issues.forEach(({ issue, message }) => {
                if (issue) {
                    rows[issue.title] = {
                        Reason: message,
                        'Assignee notified': !failed_notifications.some(
                            failed_notification => failed_notification.issue?.id === issue.id
                        ),
                    };
                }
            });
            console.table(rows);
        }
    }

    async run(): Promise<void> {
        try {
            let issues: Issue[] = await this.strategy.fetchTasksFromReleaseTagTask(RELEASE_TAG_TASK_URL);
            if (issues.length === 0) {
                logger.log(
                    'No issues found to be merged! Have you moved the cards to the "Ready - Release" status?',
                    'error'
                );
                return;
            }
            if (issues.length > MAX_TASK_COUNT) {
                logger.log(
                    `There are currently ${issues.length} tasks in Ready - Release status, merging only ${MAX_TASK_COUNT} tasks based on MAX_TASK_COUNT...`,
                    'loading'
                );
                issues = issues.slice(0, MAX_TASK_COUNT);
            }
            issues.forEach(issue => {
                logger.log(`Adding issue ${issue.title} to the release queue...`);
                this.strategy.issues_queue.enqueue(issue);
            });

            logger.log(`Release automation will start merging these ${issues.length} cards.`);

            if (!SHOULD_SKIP_SLACK_INTEGRATION) {
                try {
                    await slack.updateChannelTopic(
                        'team_private_frontend',
                        PLATFORM === 'Deriv.app' ? 'app.deriv.com' : PLATFORM,
                        `${PLATFORM} -  (master  :red_circle:)`
                    );
                } catch (err) {
                    logger.log('There was an error in updating channel team_private_frontend.', 'error');
                }
            }

            const [merged_issues, failed_issues] = await this.strategy.mergeCards();
            if (merged_issues.length) {
                await this.strategy.updateIssue(RELEASE_TAG_TASK_URL, {
                    status: 'Pending - QA',
                });
            }

            const failed_notifications: IssueError[] = [];
            if (failed_issues.length) {
                const failed_issues_by_assignee: Record<string, IssueError[]> = {};
                logger.log('Notifying assignees of any failed issues...', 'loading');
                failed_issues.forEach(failed_issue => {
                    const { assignees } = failed_issue;
                    if (assignees) {
                        assignees.forEach(assignee => {
                            if (assignee.email) {
                                if (!(assignee.email in failed_issues_by_assignee)) {
                                    failed_issues_by_assignee[assignee.email] = [failed_issue];
                                } else {
                                    failed_issues_by_assignee[assignee.email].push(failed_issue);
                                }
                            } else {
                                logger.log(`Unable to notify assignee of ${failed_issue.issue?.title}`, 'error');
                            }
                        });
                    }
                });

                Object.keys(failed_issues_by_assignee).forEach(async email => {
                    let user: SlackUser | undefined;
                    if (!SHOULD_SKIP_SLACK_INTEGRATION) {
                        try {
                            user = await slack.getUserFromEmail(email);
                            if (user) {
                                await slack.sendMessage(
                                    user.id,
                                    `Paimon has some issues with your tasks!`,
                                    loadUserHasFailedIssuesMsg(user.name || '', failed_issues_by_assignee[email])
                                );
                            } else {
                                failed_notifications.push(...failed_issues_by_assignee[email]);
                            }
                        } catch (err) {
                            logger.log(`Unable to find user to notify for issue: ${err}`, 'error');
                        }
                    }

                    const status_reqs = failed_issues_by_assignee[email].map(async ({ issue }) => {
                        if (issue) {
                            await clickup
                                .updateIssue(issue.id, {
                                    status: CLICKUP_STATUSES.IN_PROGRESS_DEV,
                                })
                                .catch(err => {
                                    logger.log(
                                        `There was an issue in updating the task ${issue.title} to In Progress - Dev status: ${err}`,
                                        'error'
                                    );
                                });
                        }
                    });
                    await Promise.allSettled(status_reqs);
                });

                logger.log(`All assignees have been successfully notified of their issues!`);
            }

            if (!SHOULD_SKIP_SLACK_INTEGRATION) {
                try {
                    const VERSION = extractVersionFromTaskName(this.strategy.regession_task?.name);
                    await slack.updateChannelTopic(
                        'task_release_planning_fe',
                        PLATFORM,
                        `- ${PLATFORM} - ${VERSION} - In Progress`
                    );
                } catch (err) {
                    logger.log('There was an error in notifying channel task_release_planning_fe.', 'error');
                }
            }

            logger.log('Release workflow has completed successfully!');
            this.logSummary(merged_issues, failed_issues, failed_notifications);
        } catch (err) {
            if (err instanceof Error) {
                logger.log(`Release workflow has failed: ${err.message}`, 'error');
            } else {
                console.log(err);
            }
        }
    }
}
