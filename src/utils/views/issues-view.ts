import { ActionsBlock, Block, HomeView } from '@slack/types';
import { Window } from './index';
import { ACTIONS, ActionArgs } from 'models/actions';
import { VIEWS, ViewArgs } from 'models/views';
import { IssueView } from './issue-view';
import { AllMiddlewareArgs, SectionBlock, SlackEventMiddlewareArgs } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { IssueId, Issue } from 'models/strategy';
import redmine from 'utils/redmine';

class IssuesModel {
    private issue_views: Map<IssueId, IssueView>;

    constructor() {
        this.issue_views = new Map<IssueId, IssueView>();
    }

    addIssue(issue: Issue) {
        const issue_view = new IssueView(issue);
        this.issue_views.set(issue_view.view_id.toString(), issue_view);
    }

    async addIssues(issue_links: string[]): Promise<void> {
        await redmine.enQueueCards(issue_links);
        redmine
            .getAllIssues()
            // since the issues are being fetched parallely, the order is not retained, thus sort it back by their original added order
            .sort((x, y: Issue) => {
                const indexX = issue_links.findIndex(issue_link => {
                    const issue_id = redmine.getIssueId(issue_link);
                    if (issue_id) {
                        return issue_id === x.id;
                    }
                });
                const indexY = issue_links.findIndex(issue_link => {
                    const issue_id = redmine.getIssueId(issue_link);
                    return issue_id?.toString() === y.id;
                });
                return indexX - indexY;
            })
            .map(issue => {
                this.addIssue(issue);
            });
    }

    clearIssueViews() {
        this.issue_views = new Map<IssueId, IssueView>();
    }

    removeIssueView(id: IssueId) {
        redmine.removeIssue(id);
        this.issue_views.delete(id);
    }

    getIssueView(id: IssueId): IssueView | undefined {
        return this.issue_views.get(id);
    }

    getAllIssueViews(): IssueView[] {
        return [...this.issue_views.values()];
    }

    get no_issue_views() {
        return this.issue_views.size === 0;
    }
}

export class IssuesView extends IssuesModel implements Window {
    constructor() {
        super();
    }

    load = (): HomeView => {
        const dropdown: ActionsBlock = {
            type: 'actions',
            elements: [
                {
                    type: 'static_select',
                    placeholder: {
                        type: 'plain_text',
                        text: 'Select a project',
                        emoji: true,
                    },
                    options: [
                        {
                            text: {
                                type: 'plain_text',
                                text: 'DERIV-APP',
                                emoji: true,
                            },
                            value: 'value-0',
                        },
                    ],
                    action_id: 'static_select-action',
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        emoji: true,
                        text: 'Get Ready cards',
                    },
                    action_id: ACTIONS.GET_READY_CARDS_BTN,
                },
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        emoji: true,
                        text: 'Add card manually',
                    },
                    ...(this.no_issue_views && { style: 'primary' }),
                    action_id: ACTIONS.ADD_CARD_BTN,
                },
            ],
        };

        if (!this.no_issue_views) {
            dropdown.elements.push({
                type: 'button',
                text: {
                    type: 'plain_text',
                    emoji: true,
                    text: 'Merge...',
                },
                style: 'primary',
                action_id: ACTIONS.MERGE_ALL_BTN,
            });
        }

        const blocks: Block[] = [dropdown];
        if (!this.no_issue_views) {
            this.getAllIssueViews()
                .filter(issue_view => !issue_view.merged)
                .forEach(issue_view => blocks.push(...issue_view.load()));
        } else {
            const no_issue: SectionBlock = {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: "There's no issues here! Start by adding some Redmine card links by clicking Add card manually button.",
                },
            };
            blocks.push(no_issue);
        }

        return {
            type: 'home',
            callback_id: VIEWS.MAIN_VIEW,
            blocks,
        };
    };

    mountOnAppHomeOpened = async (
        args: SlackEventMiddlewareArgs<'app_home_opened'> & AllMiddlewareArgs<StringIndexed>
    ) => {
        console.log('IssuesView', this);
        const { client, event } = args;
        // TODO: for simple authentication, check if users are release managers, cuz they should only have access to the home dashboard!
        console.log('LOAD', this);
        await client.views.publish({
            user_id: event.user,
            view: this.load(),
        });
    };

    mount = async <T extends ActionArgs | ViewArgs>(args: T): Promise<void> => {
        console.log('mounting issues view');
        const { body, client } = args;

        console.log('ASDASD', this, this.load);
        await client.views.publish({
            user_id: body.user.id,
            view: this.load(),
        });
    };

    // SlackActionMiddlewareArgs<SlackAction> & AllMiddlewareArgs<StringIndexed>
    update = async (payload: ViewArgs) => {
        const { body, client } = payload;

        await client.views.update({
            user_id: body.user.id,
            view_id: body.view.id,
            view: this.load(),
        });
    };
}
