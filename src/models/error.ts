import { Assignee, Issue } from './strategy';

export enum IssueErrorType {
    ALREADY_MERGED,
    NEEDS_APPROVAL,
    FAILED_CHECKS,
    FAILED_WORKFLOW,
    HAS_MERGE_CONFLICTS,
    NEEDS_PULL_REQUEST,
    STATUS_NOT_READY,
}

export class IssueError extends Error {
    assignee?: Assignee;
    issue?: Issue;
    name = 'IssueError';
    message: string;
    type: IssueErrorType;

    constructor(type: IssueErrorType, issue?: Issue, assignee?: Assignee) {
        super();
        this.type = type;
        this.issue = issue;
        this.assignee = assignee;

        switch (type) {
            case IssueErrorType.ALREADY_MERGED:
                this.message = 'PR in the card has already been merged.';
                break;
            case IssueErrorType.NEEDS_APPROVAL:
                this.message = 'PR requires approval from code owners before merging.';
                break;
            case IssueErrorType.HAS_MERGE_CONFLICTS:
                this.message = 'PR has merge conflicts.';
                break;
            case IssueErrorType.FAILED_CHECKS:
                this.message = 'PR have failed checks that needs to be addressed.';
                break;
            case IssueErrorType.FAILED_WORKFLOW:
                this.message = 'The release staging workflow in CircleCI has failed.';
                break;
            case IssueErrorType.NEEDS_PULL_REQUEST:
                this.message = 'The card needs to have the pull request link in the description.';
                break;
            case IssueErrorType.STATUS_NOT_READY:
                this.message = 'The card status needs to be in Ready.';
                break;
        }
    }
}
