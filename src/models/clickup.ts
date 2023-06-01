import { IssueId } from './strategy';

export type User = {
    id: number;
    username: string;
    email: string;
};

export type CustomField = {
    id: string;
    name: string;
    type: string;
    value: string;
};

export type Task = {
    id: IssueId;
    name: string;
    status: {
        id: string;
        status: string;
        type: string;
    };
    description: string;
    creator: User;
    assignees: User[];
    custom_fields?: CustomField[];
    parent: IssueId;
};

export type Status = {
    id: string;
    status: string;
    type: string;
};

export type Space = {
    id: string;
    name: string;
    statuses: Status[];
};

export type Template = {
    name: string;
    id: string;
};

export type UpdateIssueParams = {
    name: string; // required string
    description: string; // required string
    status: string; // required string
    priority: number; // required integer <int32>
    due_date: number; // required integer <int64>
    due_date_time: boolean; // required boolean
    parent: string | null; // required string (null allowed)
    time_estimate: number; // required integer <int32>
    start_date: number; // required integer <int64>
    start_date_time: boolean; // required boolean
    assignees: Partial<User>;
    archived: boolean; // required boolean
};
