import { ActionsBlock, Block, Button, HeaderBlock } from '@slack/types';
import { Window } from 'views/index';
import { ACTIONS } from 'models/actions';
import { IssueStatusView } from './issue-status-view';
import { IssueDetailsView } from './issue-details-view';
import { Issue, IssueId } from 'models/strategy';
import github from 'utils/github';

const DIVIDER = {
    type: 'divider',
};

export type IssueStatus = {
    merged: boolean;
    tagged?: boolean;
    should_be_released: boolean;
    is_mergable: boolean;
    is_merging: boolean;
    queued: boolean;
    has_error: boolean;
    has_failing_workflow: boolean;
};

class IssueModel {
    issue: Issue;
    status: IssueStatus;

    constructor(issue: Issue) {
        this.issue = issue;
        this.status = {
            merged: false,
            should_be_released: false,
            is_mergable: true,
            is_merging: false,
            queued: true,
            has_error: false,
            has_failing_workflow: false,
        };
    }

    get title() {
        return this.issue.title;
    }

    get is_mergable() {
        return this.status.is_mergable;
    }

    get merged() {
        return this.status.merged;
    }

    get should_be_released() {
        return this.status.should_be_released;
    }

    setStatus(new_status: Partial<IssueStatus>) {
        this.status = {
            ...this.status,
            ...new_status,
        };
    }
}

export class IssueView extends IssueModel implements Window {
    view_id: IssueId;
    details: IssueDetailsView;

    // temporary placeholder, remove later and use issue as argument
    constructor(issue: Issue) {
        super(issue);
        this.details = new IssueDetailsView(issue);
        this.view_id = issue.id;
    }

    private loadIssueViewButtons(): ActionsBlock {
        const main_button: Button = !this.status.merged
            ? {
                  type: 'button',
                  text: {
                      type: 'plain_text',
                      emoji: true,
                      text: 'Remove',
                  },
                  style: 'danger',
                  action_id: `${ACTIONS.REMOVE_BTN}.${this.view_id}`,
              }
            : {
                  type: 'button',
                  text: {
                      type: 'plain_text',
                      emoji: true,
                      text: 'Revert',
                  },
                  style: 'danger',
                  action_id: `${ACTIONS.REVERT_BTN}.${this.view_id}`,
              };
        return {
            type: 'actions',
            elements: [main_button],
        };
    }

    load(): Block[] {
        console.log('Loading issues view...');
        const header: HeaderBlock = {
            type: 'header',
            text: {
                type: 'plain_text',
                text: ` ${this.issue.title}`,
                emoji: true,
            },
        };

        const pr_link = github.getGitHubPR(this.issue.description);
        const status = new IssueStatusView(pr_link).load();
        const details = this.details.load();
        const buttons: ActionsBlock = this.loadIssueViewButtons();

        return [header, status, details, buttons, DIVIDER];
    }
}
