import { SectionBlock, MrkdwnElement } from '@slack/types';
import { Window } from '..';
import { Issue } from 'models/strategy';
import github from 'utils/github';

const status: Record<string, string> = {
    'In Progress': '🟡',
    'Needs QA': '🟠',
    'Needs review': '🔵',
    Archived: '⚪',
    New: '⚪',
    Backlog: '⚪',
    Blocked: '🔴',
    Closed: '🟤',
    Merged: '🟣',
    Ready: '🟢',
};

export class IssueDetailsView implements Window {
    issue: Issue;

    constructor(issue: Issue) {
        this.issue = issue;
    }

    generateVersionTag(): string {
        const today = new Date();
        const appendZero = (n: number) => (n < 10 ? `0${n}` : n);
        const day = appendZero(today.getDate());
        const month = appendZero(today.getMonth() + 1);
        return `${today.getFullYear()}${month}${day}_0`;
    }

    loadTags(): MrkdwnElement {
        if (this.issue.tags) {
            const tags = this.issue.tags.length ? this.issue.tags.map(tag => '`' + tag + '`').join('  ') : 'None';
            return {
                type: 'mrkdwn',
                text: '*🏷️ Tags:*\n' + tags,
            };
        }
        return {
            type: 'mrkdwn',
            text: '*🏷️ Tags:*\n' + '*None*',
        };
    }

    loadVotes(): MrkdwnElement {
        if (this.issue.custom_fields) {
            const votes = this.issue.custom_fields.find(field => field.name === 'Votes')?.value;
            return {
                type: 'mrkdwn',
                text: `*🗳️ Vote count:*\n${votes}`,
            };
        }
        return {
            type: 'mrkdwn',
            text: `*🗳️ Vote count:*\n*None*`,
        };
    }

    load(): SectionBlock {
        const version_tag = this.generateVersionTag();
        let pr_link = '';
        try {
            pr_link = github.getGitHubPR(this.issue.description);
        } catch (err) {
            console.log(err);
        }

        return {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*🧑 Assignee:*\n${this.issue.assignee?.name || 'None'}`,
                },
                this.loadVotes(),
                {
                    type: 'mrkdwn',
                    text: `*${status[this.issue.status]} Status:*\n` + '`' + this.issue.status + '`',
                },
                this.loadTags(),
                {
                    type: 'mrkdwn',
                    text: `*🔗 PR Link:*\n${pr_link ?? 'No PR link attached'}`,
                },
                {
                    type: 'mrkdwn',
                    text: '*🗓️ Version to tag:*\n`' + version_tag + '`',
                },
            ],
        };
    }
}
