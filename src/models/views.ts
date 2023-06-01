import {
    SlackViewMiddlewareArgs,
    SlackViewAction,
    AllMiddlewareArgs,
    Block,
    View,
    ViewSubmitAction,
} from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { ActionArgs } from './actions';

export const enum VIEWS {
    ERROR_MODAL = 'ERROR_MODAL',
    ADD_CARD_MODAL = 'ADD_CARD_MODAL',
    LOADING_VIEW = 'LOADING_VIEW',
    MAIN_VIEW = 'MAIN_VIEW',
    MERGE_ALL_MODAL = 'MERGE_ALL_MODAL',
    MERGING_CARDS_VIEW = 'MERGING_CARDS_VIEW',
    NO_ISSUES_VIEW = 'NO_ISSUES_VIEW',
}

export type ViewArgs = SlackViewMiddlewareArgs<SlackViewAction> & AllMiddlewareArgs<StringIndexed>;
export type ViewArgsWithTriggerIDs = SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs<StringIndexed>;

export interface Window {
    load(): Block | Block[] | View;
    mount?<T extends ActionArgs | ViewArgs>(args: T): Promise<void>;
    update?(args: ViewArgs): Promise<void>;
    handleError?(err: Error): any;
}

export interface Message extends Window {
    load(): Block | Block[];
}
