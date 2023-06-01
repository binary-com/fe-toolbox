import { ModalView } from '@slack/types';
import { ACTIONS, ActionArgsWithActionIDs } from 'models/actions';
import { VIEWS, ViewArgsWithTriggerIDs } from 'models/views';
import { BLOCKS } from 'models/blocks';
import { IssueView } from './issue-view';
import { Modal } from '.';

export class AddCardModal implements Modal {
    load(): ModalView {
        return {
            type: 'modal',
            callback_id: VIEWS.ADD_CARD_MODAL,
            title: {
                type: 'plain_text',
                text: 'Add one or more cards',
            },
            blocks: [
                {
                    type: 'input',
                    block_id: BLOCKS.ADD_CARD_INPUT_BLOCK,
                    label: {
                        type: 'plain_text',
                        text: 'Enter the Redmine card links here with each link at a newline',
                    },
                    element: {
                        type: 'plain_text_input',
                        action_id: ACTIONS.ADD_CARD_INPUT,
                        multiline: true,
                    },
                },
            ],
            submit: {
                type: 'plain_text',
                text: 'Add cards',
            },
        };
    }

    mount = async <T extends ViewArgsWithTriggerIDs | ActionArgsWithActionIDs>(args: T): Promise<void> => {
        const { body, client } = args;
        await client.views.open({
            trigger_id: body.trigger_id,
            view: this.load(),
        });
    };
}

export class MergeAllModal implements Modal {
    load(issues_view: IssueView[]): ModalView {
        return {
            type: 'modal',
            callback_id: VIEWS.MERGE_ALL_MODAL,
            title: {
                type: 'plain_text',
                text: 'Merge these cards?',
            },
            blocks: [
                {
                    type: 'input',
                    block_id: BLOCKS.RELEASE_CARD_INPUT_BLOCK,
                    element: {
                        type: 'checkboxes',
                        options: issues_view.map(issue_view => {
                            return {
                                text: {
                                    type: 'mrkdwn',
                                    text: `*${issue_view.title}*`,
                                },
                                value: String(issue_view.view_id),
                            };
                        }),
                        action_id: ACTIONS.MERGE_CARDS_CHECKBOX,
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Check the cards which is to be merged',
                        emoji: true,
                    },
                },
            ],
            submit: {
                type: 'plain_text',
                text: 'Merge cards',
            },
            notify_on_close: true,
        };
    }

    mount = async <T extends ViewArgsWithTriggerIDs>(args: T, issue_views: IssueView[]): Promise<void> => {
        const { body, client } = args;
        await client.views.open({
            trigger_id: body.trigger_id,
            view: this.load(issue_views),
        });
    };
}
