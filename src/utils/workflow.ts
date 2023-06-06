import { Issue, ReleaseStrategyType } from '../models/strategy';
import clickup from './clickup';
import slack from './slack';
import { loadUserHasFailedIssuesMsg } from './slack/messages';
import { IssueError } from 'models/error';
import logger from './logger';
import { LIST_ID, PLATFORM, TAG } from './config';
import { SlackUser } from 'models/slack';

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
            const issues: Issue[] = await this.strategy.fetchIssues(LIST_ID, 'ready - release');
            if (issues.length === 0) {
                logger.log(
                    'No issues found to be merged! Have you moved the cards to the "Ready - Release" status?',
                    'error'
                );
                return;
            }
            issues.forEach(issue => {
                logger.log(`Adding issue ${issue.title} to the release queue...`);
                this.strategy.issues_queue.enqueue(issue);
            });

            logger.log(`Release automation will start merging these ${issues.length} cards.`);
            try {
                await slack.updateChannelTopic(
                    'team_private_frontend',
                    PLATFORM === 'Deriv.app' ? 'app.deriv.com' : PLATFORM,
                    `${PLATFORM} -  (develop :red_circle: , master  :red_circle:)`
                );
            } catch (err) {
                logger.log('There was an error in notifying channel team_private_frontend.', 'error');
            }

            const [merged_issues, failed_issues] = await this.strategy.mergeCards();
            if (merged_issues.length) {
                const version = await this.strategy.createVersion(TAG);
                const tag_reqs = merged_issues.map(issue => this.strategy.addVersionToTask(issue, version));
                await Promise.all(tag_reqs);
                await this.strategy.createRegressionTestingIssue(version);
            }

            const failed_notifications: IssueError[] = [];
            if (failed_issues.length) {
                const failed_issues_by_assignee: Record<string, IssueError[]> = {};
                logger.log('Notifying assignees of any failed issues...', 'loading');
                failed_issues.forEach(failed_issue => {
                    const { assignee } = failed_issue;
                    if (assignee) {
                        if (assignee.email) {
                            if (!(assignee.email in failed_issues_by_assignee)) {
                                failed_issues_by_assignee[assignee.email] = [failed_issue];
                            } else {
                                failed_issues_by_assignee[assignee.email].push(failed_issue);
                            }
                        } else {
                            logger.log(`Unable to notify assignee of ${failed_issue.issue?.title}`, 'error');
                        }
                    }
                });

                Object.keys(failed_issues_by_assignee).forEach(async email => {
                    let user: SlackUser | undefined;
                    try {
                        user = await slack.getUserFromEmail(email);
                    } catch (err) {
                        logger.log('Unable to find user to notify for issue.', 'error');
                    }

                    failed_issues_by_assignee[email].forEach(async ({ issue }) => {
                        if (issue) {
                            await clickup.updateIssue(issue.id, {
                                status: 'In Progress - Dev',
                            });
                        }
                    });

                    if (user) {
                        await slack.sendMessage(
                            user.id,
                            `Paimon has some issues with your tasks!`,
                            loadUserHasFailedIssuesMsg(user.name || '', failed_issues_by_assignee[email])
                        );
                    } else {
                        failed_notifications.push(...failed_issues_by_assignee[email]);
                    }
                });

                logger.log(`All assignees have been successfully notified of their issues!`);
            }

            try {
                await slack.updateChannelTopic(
                    'task_release_planning_fe',
                    PLATFORM,
                    `- ${PLATFORM} - ${TAG} - In Progress`
                );
            } catch (err) {
                logger.log('There was an error in notifying channel task_release_planning_fe.', 'error');
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
