import { Block, HomeView, SectionBlock } from '@slack/types';
import { Window } from '.';
import { VIEWS, ViewArgs } from 'models/views';
import { ActionsBlock, HeaderBlock } from '@slack/bolt';
import { ACTIONS, ActionArgs } from 'models/actions';
import { view_manager } from 'utils/manager';
import logger from 'utils/logger';

export type MergingIssuesViewStatus = {
    has_workflow_error: boolean;
    is_merging: boolean;
    merge_completed: boolean;
};

export default class MergingIssuesView implements Window {
    private view_hash: string = '';
    private view_id: string = '';
    status: MergingIssuesViewStatus;
    payload: ActionArgs | ViewArgs | undefined;

    constructor() {
        this.status = {
            has_workflow_error: false,
            is_merging: false,
            merge_completed: false,
        };
    }

    setMergingIssuesViewStatus(new_status: Partial<MergingIssuesViewStatus>) {
        this.status = {
            ...this.status,
            ...new_status,
        };
    }

    loadLoggerView(): [HeaderBlock, SectionBlock] {
        return [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '📝 Logs',
                    emoji: true,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '```' + logger.getAllLogs() + '```',
                },
            },
        ];
    }

    load = (): HomeView => {
        const fields: SectionBlock[] = [];

        const issues_to_be_released = view_manager
            .getView(VIEWS.MAIN_VIEW)
            .getAllIssueViews()
            .filter(issue_view => issue_view.status.should_be_released);

        issues_to_be_released.forEach(issue_view => {
            if (issue_view.status.merged) {
                fields.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*[✅ Merged]* ${issue_view.title}`,
                    },
                });
            } else if (issue_view.status.is_merging) {
                fields.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*[🚀 Merging...]* ${issue_view.title}`,
                    },
                });
            } else if (issue_view.status.has_error) {
                fields.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*[❌ Cannot merge]* ${issue_view.title}`,
                    },
                });
            } else {
                fields.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*[💤 Enqueued]* ${issue_view.title}`,
                    },
                });
            }
        });

        const issue_details = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '🔔 Status',
                    emoji: true,
                },
            },
            ...fields,
        ];

        if (this.status.has_workflow_error) {
            issue_details.unshift({
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '🚨 The main branch has failing CircleCi workflow! Release automation has been halted.',
                    emoji: true,
                },
            });
        }

        let blocks: Block[] = issue_details;
        if (this.status.merge_completed || this.status.has_workflow_error) {
            const button: ActionsBlock = {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Return',
                            emoji: true,
                        },
                        value: 'click_me_123',
                        action_id: ACTIONS.RETURN_BTN,
                    },
                ],
            };

            blocks.push(button);
        }

        blocks.push(...this.loadLoggerView());
        return {
            type: 'home',
            callback_id: VIEWS.MERGING_CARDS_VIEW,
            blocks,
        };
    };

    mount = async <T extends ActionArgs | ViewArgs>(payload: T) => {
        this.payload = payload;
        const { body, client } = payload;

        this.view_id = '';
        this.view_hash = '';

        let view_payload = await client.views.publish({
            user_id: body.user.id,
            view: this.load(),
        });
        if (view_payload.view) {
            this.view_id = <string>view_payload.view.id;
            this.view_hash = <string>view_payload.view.hash;
        }
    };

    update = async () => {
        if (this.payload) {
            const { ack, body, client } = this.payload;

            await ack();
            let view_payload = await client.views.update({
                user_id: body.user.id,
                hash: this.view_hash,
                view_id: this.view_id,
                view: this.load(),
            });
            if (view_payload.view) {
                this.view_id = <string>view_payload.view.id;
                this.view_hash = <string>view_payload.view.hash;
            }
        }
    };

    get has_mounted() {
        return this.payload !== undefined;
    }
}
