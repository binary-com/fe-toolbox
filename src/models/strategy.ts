import { IssueError } from './error';
import { Clickup } from '../utils/clickup';

export type Assignee = {
    id: number;
    name: string;
    email: string;
};

export type CustomField<T = string> = {
    id: string;
    name: string;
    value: T;
};

export type IssueId = string;
export type Issue = {
    id: IssueId;
    title: string;
    description: string;
    status: string;
    assignees?: Assignee[];
    pull_request?: string;
    tags?: string[];
    custom_fields?: CustomField[];
};
export type FailedIssue = {
    issue: Issue;
    cause: IssueError;
};

export class IssueQueue {
    private queue: Array<Issue>;
    private lookup: Map<IssueId, Issue>;

    constructor() {
        this.queue = [];
        this.lookup = new Map<IssueId, Issue>();
    }

    get head(): Issue | undefined {
        return !this.is_empty ? this.queue[0] : undefined;
    }

    get tail(): Issue | undefined {
        return !this.is_empty ? this.queue[this.queue.length - 1] : undefined;
    }

    get is_empty() {
        return this.queue.length === 0;
    }

    get issues() {
        return this.queue;
    }

    /**
     * Enqueues the current issue into the queue. If the issue already exists in the queue, it updates it in the queue instead.
     *
     * @param {Issue} new_issue - The new issue to be enqueued
     */
    enqueue(new_issue: Issue) {
        if (this.hasIssue(new_issue.id)) {
            this.update(new_issue);
        } else {
            this.queue.push(new_issue);
            this.lookup.set(new_issue.id, new_issue);
        }
    }

    /**
     * Dequeues the current issue from the queue
     *
     * @returns {Issue | undefined} the dequeued issue, or undefined if the queue is empty
     */
    dequeue(): Issue | undefined {
        return this.queue.shift();
    }

    /**
     * Removes an issue from the queue without dequeueing it from the queue tail
     *
     * @param issue_id The redmine/clickup ID of the issue to be inserted
     */
    remove(issue_id: IssueId) {
        const index = this.queue.findIndex(issue => issue.id === issue_id);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
    }

    /**
     * Updates the issue in the queue without dequeuing it
     *
     * @param {Issue} new_issue - The new issue to be updated
     */
    update(new_issue: Issue) {
        const index = this.queue.findIndex(issue => issue.id === new_issue.id);
        if (index !== -1) {
            this.queue[index] = new_issue;
        }
    }

    clear() {
        this.queue = [];
        this.lookup = new Map<IssueId, Issue>();
    }

    getIssueById(id: IssueId): Issue | undefined {
        return this.lookup.get(id);
    }

    hasIssue(id: IssueId): boolean {
        return this.lookup.has(id);
    }

    getAllIssues(): Issue[] {
        return this.queue;
    }
}

export type ReleaseStrategyType = Clickup;

export interface ReleaseStrategy {
    issues_queue: IssueQueue;
    fetchIssues(...args: any[]): Promise<Issue[]>;
    fetchIssue(issue_id: IssueId): Promise<Issue>;
    mergeCards(...args: any[]): Promise<[Issue[], IssueError[]]>;
}
