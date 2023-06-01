export enum PRIORITY {
    NORMAL = 2,
    HIGH = 3,
    URGENT = 4,
    IMMEDIATE = 6,
}

export enum ASSIGNEE {
    QA = 48,
    ADRIENNE = 1517,
}

export enum PROJECT {
    WEB_TEAM = 245,
}

export enum TRACKER {
    BUG = 1,
    REGRESSION_TESTING = 12,
}

export enum STATUS {
    NEW = 1,
    IN_PROGRESS = 2,
    READY = 3,
    NEEDS_QA = 4,
    BLOCKED = 7,
    NEEDS_REVIEW = 8,
    BACKLOG = 10,
    MERGED = 12,
    ARCHIVED = 30,
}

type CustomField = {
    id: number;
    multiple?: boolean;
    name: string;
    value: string;
};

type Field = {
    id: number;
    name: string;
};

export type Issue = {
    assigned_to: Field;
    author: Field;
    closed_on: Date;
    created_on: Date;
    custom_fields: CustomField[];
    description: string;
    due_date: Date;
    estimated_hours: string;
    id: number;
    parent: { id: number };
    lock_version: string;
    priority: Field;
    project: Field;
    root_id: string;
    start_date: Date;
    status: Field;
    subject: string;
    tracker: Field;
    updated_on: Date;
    tags: string[];
    fixed_version: Field;
};

export type User = {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    mail?: string;
    created_on: string;
    last_login_on: string;
    custom_fields: CustomField[];
};

export type PostIssueParams = {
    project_id?: string;
};

export type UpdateIssueParams = {
    status_id: STATUS;
    tracker_id: number;
    priority_id: PRIORITY;
    subject: string;
    fixed_version_id: number;
    assigned_to_id: number;
    parent_issue_id: number;
};

export type Version = {
    id: number;
    project: Field;
    name: string;
    description: string;
    status: string;
    due_date: string | null;
    sharing: string;
    wiki_page_title: string | null;
    estimated_hours: number;
    spent_hours: number;
    custom_fields: CustomField[];
    created_on: string;
    updated_on: string;
    tag: string;
};

export type CreateVersionResponse = {
    version: Version;
    version_tag: string;
};
