import { SlackEventMiddlewareArgs, AllMiddlewareArgs } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import slack from '../slack';
import view_manager from './view-manager';
import { VIEWS, ViewArgs } from '../../models/views';
import { Issue } from '../../models/strategy';
import { ACTIONS, ActionArgs } from '../../models/actions';
import { BLOCKS } from '../../models/blocks';
import { IssueError, IssueErrorType } from '../../models/error';
import redmine from '../redmine';
import { loadUserHasFailedIssuesMsg } from '../slack/messages';
import logger from '../logger';

/**
 * The event manager handles all event-related activities for slack events and release workflow events.
 */
class EventManager {
    registerEvents = () => {
        slack.registerEvent('app_home_opened', this.onHomeViewOpened);
        slack.registerView(VIEWS.ADD_CARD_MODAL, this.onSubmitAddCardModal);
        slack.registerView(VIEWS.MERGE_ALL_MODAL, this.onSubmitReleaseCardModal);
    };

    /**
     * Method that handles event where the main home view is visible to the user.
     * When the home view is visible to the user, it will show either:
     * - The issues view, if the merging workflow has not started yet
     * - The merging issues view, if the merging workflow has started
     *
     * The merging workflow will start once the user submits the checklist of issues after user clicks `Merge...` button and submits the modal shown.
     *
     * @async
     * @param {SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs<StringIndexed>} payload - The payload arguments returned by a Slack action/event
     */
    async onHomeViewOpened(payload: SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs<StringIndexed>) {
        if (view_manager.current_view === VIEWS.MAIN_VIEW) {
            await view_manager.mountOnAppHomeOpened()(payload);
        }
    }

    /**
     * Method that handles event where the add card modal is being submitted.
     * Once the add card modal is submitted, the issue links that are added in the input will be enqueued for merging later.
     *
     * @async
     * @template T
     * @param {T} payload - The payload arguments returned by a Slack action/event
     */
    onSubmitAddCardModal = async (payload: ViewArgs) => {
        const { ack, view } = payload;
        await ack();
        await view_manager.mountView(VIEWS.LOADING_VIEW)(payload);

        const links = view.state.values[BLOCKS.ADD_CARD_INPUT_BLOCK][ACTIONS.ADD_CARD_INPUT].value;
        try {
            if (links) {
                const redmine_links = links.split(/[ \n]+/);
                await this.onAddingIssues(payload, redmine_links);
            }
        } catch (err) {
            // TODO: FIX THIS LATER, the validation is not working
            await ack({
                response_action: 'errors',
                errors: {
                    [BLOCKS.ADD_CARD_INPUT_BLOCK]: `Unable to fetch issues: ${err}`,
                },
            });
        }
    };

    /**
     * Method that handles event where the release card modal is being submitted.
     * Once the release card modal is submitted, the merging issues view should be shown and the merging workflow will start.
     *
     * @async
     * @template T
     * @param {T} payload - The payload arguments returned by a Slack action/event
     */
    onSubmitReleaseCardModal = async (payload: ViewArgs) => {
        const { ack, view } = payload;
        await ack();

        const { selected_options } = view.state.values[BLOCKS.RELEASE_CARD_INPUT_BLOCK][ACTIONS.MERGE_CARDS_CHECKBOX];
        if (selected_options) {
            const selected_options_ids = selected_options.map(option => option.value);
            await view_manager.mountView(VIEWS.MERGING_CARDS_VIEW, selected_options_ids)(payload);

            logger.info('Updating team_private_frontend channel...');
            await slack.updateChannelTopic(
                'team_private_frontend',
                'app.deriv.com',
                'app.deriv.com -  (develop :red_circle: , master  :red_circle:)'
            );

            console.log(
                'cards to be merged',
                selected_options_ids,
                redmine.getAllIssues().map(issue => issue.id)
            );

            await redmine.mergeCards(selected_options_ids);

            const failed_issues_by_assignee: Record<string, IssueError[]> = {};

            logger.info('Notifying assignees of any failed issues...');
            redmine.getAllFailedIssues().forEach(failed_issue => {
                const { assignee } = failed_issue;
                if (assignee) {
                    if (assignee.email) {
                        if (!(assignee.email in failed_issues_by_assignee)) {
                            failed_issues_by_assignee[assignee.email] = [failed_issue];
                        } else {
                            failed_issues_by_assignee[assignee.email].push(failed_issue);
                        }
                    }
                }
            });
            // send notifcation to failed assignee
            Object.keys(failed_issues_by_assignee).forEach(async email => {
                const failed_issues = failed_issues_by_assignee[email];
                const user = await slack.getUserFromEmail(email);
                if (user) {
                    await slack.sendMessage(
                        user.id,
                        'Paimon has some issues with your cards!',
                        loadUserHasFailedIssuesMsg(user.name ?? '', failed_issues)
                    );
                }
            });

            if (!view_manager.has_workflow_error) {
                //     // NOTE: Uncomment this once error handling is completed
                //     // const version = await redmine.createVersion();
                //     // const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
                //     // await sleep(20000); // wait for 20 seconds for the version to be created in Redmine
                //     // const update_version_reqs = selected_options_ids.map(issue_id =>
                //     //     redmine.updateIssue(issue_id, {
                //     //         fixed_version_id: version.id,
                //     //     })
                //     // );
                //     // await Promise.allSettled(update_version_reqs);
                //     // await redmine.createRegressionTestingIssue(version);
                //     // await slack.updateChannelTopic(
                //     //     'task_release_planning_fe',
                //     //     'Deriv.app',
                //     //     `- Deriv.app - ${version.tag} - In Progress`
                //     // );
            }

            await this.onCompletedRelease(payload);
        }
    };

    /**
     * Method that handles event where issues are being added to the release queue
     *
     * @async
     * @template T
     * @param {T} payload - The payload arguments returned by a Slack action/event
     * @param {string[]} links - The array of redmine/clickup links that are added to the queue
     */
    async onAddingIssues<T extends ActionArgs | ViewArgs>(payload: T, links: string[]) {
        await view_manager.getView(VIEWS.MAIN_VIEW).addIssues(links);
        await view_manager.mountView(VIEWS.MAIN_VIEW)(payload);
    }

    /**
     * Method that handles event where an issue is currently scheduled to be merged / is currently merging
     *
     * @param {Issue} issue - The issue that is scheduled to be merged
     */
    onMergingIssue(issue: Issue) {
        view_manager.setIssueViewStatus(issue.id, {
            is_merging: true,
        });
    }

    /**
     * Method that handles event where an issue is merged
     *
     * @param {Issue} issue - The issue that was just merged
     */
    onMergedIssue(issue: Issue) {
        view_manager.setIssueViewStatus(issue.id, {
            is_merging: false,
            merged: true,
        });
    }

    /**
     * Method that handles event where all issues has been merged and the merge queue is empty.
     * This event will wait for all the logs and updates to be printed out, and resets the view state to show the issues view again.
     *
     * @async
     * @template T
     * @param {T} payload - The payload arguments returned by a Slack action/event
     */
    async onCompletedRelease<T extends ActionArgs | ViewArgs>(payload: T) {
        await logger.waitForAllLogs();
        view_manager.getView(VIEWS.MERGING_CARDS_VIEW).setMergingIssuesViewStatus({
            merge_completed: true,
        });
        view_manager.getView(VIEWS.MERGING_CARDS_VIEW).mount(payload);
    }

    /**
     * Method that handles issue related errors that occurs during the merging workflow or when adding new issues.
     * This event will update the merging issues view to display any errors related to the issue.
     *
     * @param {Required<IssueError>} err - The issue related error object
     */
    onError(err: IssueError) {
        if (err instanceof IssueError) {
            const { issue, type } = err;
            switch (type) {
                case IssueErrorType.FAILED_WORKFLOW:
                    view_manager.getView(VIEWS.MERGING_CARDS_VIEW).setMergingIssuesViewStatus({
                        has_workflow_error: true,
                    });
                    if (issue) {
                        view_manager.setIssueViewStatus(issue.id, {
                            has_failing_workflow: true,
                        });
                    }
                    break;
                default:
                    if (issue) {
                        view_manager.setIssueViewStatus(issue.id, {
                            is_merging: false,
                            has_error: true,
                            queued: true,
                        });
                    }
            }
        }
    }
}

export default new EventManager();
