import { SectionBlock } from '@slack/bolt';
import { IssueError, IssueErrorType } from '../../models/error';
import { Issue } from '../../models/strategy';
import github from '../../utils/github';

const error_label: Record<string, string> = {
    [IssueErrorType.ALREADY_MERGED]: '✔️ PR has already been merged',
    [IssueErrorType.FAILED_CHECKS]: '🚧 PR has failed checks or has insufficient approvals',
    [IssueErrorType.NEEDS_PULL_REQUEST]: '🤷 No PR in issue description and card field',
    [IssueErrorType.HAS_MERGE_CONFLICTS]: '🔄 PR has has merge conflicts',
    [IssueErrorType.STATUS_NOT_READY]: '🚫 Issue is not in Ready status',
    [IssueErrorType.NEEDS_APPROVAL]: '🚫 PR has insufficient approvals'
};

export function loadUserHasFailedIssuesMsg(recepient_user_name: string, failed_issues: IssueError[]) {
    const title: SectionBlock = {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `Hey <@${recepient_user_name}>! Paimon sees that you have some issues with these cards, please resolve them if you can so Paimon can release them later!\n`,
        },
    };

    const issues: SectionBlock[] = failed_issues.map(({ type, issue }) => {
        const failed_issue = issue as Issue;
        const pr_link = github.getGitHubPR(failed_issue.description);
        return {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*[${error_label[type]}]* ${
                    type !== IssueErrorType.NEEDS_PULL_REQUEST
                        ? `<${pr_link}|${failed_issue.title}>`
                        : failed_issue.title
                }`,
            },
        };
    });

    return [title, ...issues];
}
