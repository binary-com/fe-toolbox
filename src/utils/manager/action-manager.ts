import { ACTIONS, ActionArgs, ActionArgsWithActionIDs } from '../../models/actions';
import slack from '../slack';
import view_manager from './view-manager';
import redmine from '../redmine';
import logger from '../logger';
import { VIEWS, ViewArgsWithTriggerIDs } from '../../models/views';

/**
 * The action manager manages all actions invoked by slack actions such as clicking a button
 * Any new actions to be registered should be declared within this class.
 */
class ActionManager {
    registerActions() {
        const match_remove_card_btn = new RegExp(`${ACTIONS.REMOVE_BTN}.*`);

        // TODO: Uncomment these later when we transition back to using Slack bot approach
        // slack.registerAction(ACTIONS.MERGE_ALL_BTN, this.mergeAllAction);
        // slack.registerAction(ACTIONS.ADD_CARD_BTN, this.addCardAction);
        slack.registerAction(ACTIONS.RETURN_BTN, this.returnAction);
        // slack.slack.action(ACTIONS.GET_READY_CARDS_BTN, this.getReadyCardsAction);
        // slack.registerAction(match_remove_card_btn, this.removeCardAction);
    }

    async addCardAction(payload: ViewArgsWithTriggerIDs) {
        const { ack } = payload;

        await ack();
        await view_manager.mountModal(VIEWS.ADD_CARD_MODAL)(payload);
    }

    async mergeAllAction(payload: ViewArgsWithTriggerIDs) {
        const { ack } = payload;
        await ack();
        await view_manager.mountReleaseCardModal()(payload);
    }

    async removeCardAction<T extends ActionArgsWithActionIDs>(payload: T) {
        const { ack } = payload;
        const action = payload.action;
        const issues_view = view_manager.getView(VIEWS.MAIN_VIEW);

        await ack();
        const id = action.action_id.split('.')[1];
        const issue = issues_view.getIssueView(id);
        if (issue) {
            view_manager.getView(VIEWS.MAIN_VIEW).removeIssueView(issue.view_id);
            await view_manager.mountView(VIEWS.MAIN_VIEW)(payload);
        }
    }

    async returnAction(payload: ActionArgs) {
        const { ack } = payload;
        await ack();

        await view_manager.mountView(VIEWS.LOADING_VIEW)(payload);
        redmine.clearIssues();
        logger.clearLogs();
        view_manager.getView(VIEWS.MAIN_VIEW).clearIssueViews();
        await view_manager.mountView(VIEWS.MAIN_VIEW)(payload);
    }
}

export default new ActionManager();
