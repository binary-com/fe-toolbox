import { AllMiddlewareArgs } from '@slack/bolt/dist/types';
import { BlockAction, SlackAction, SlackActionMiddlewareArgs } from '@slack/bolt/dist/types/actions';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';

export const enum ACTIONS {
    ADD_CARD_BTN = 'ADD_CARD_BTN',
    ADD_CARD_INPUT = 'ADD_CARD_INPUT',
    ADD_CARD_MODAL_BTN = 'ADD_CARD_MODAL_BTN',
    FIXED_ISSUES_BTN = 'FIXED_ISSUES_BTN',
    GET_READY_CARDS_BTN = 'GET_READY_CARDS_BTN',
    MANUAL_TAG_BTN = 'MANUAL_TAG_BTN',
    MERGE_ALL_BTN = 'MERGE_ALL_BTN',
    MERGE_CARDS_CHECKBOX = 'RELEASE_CARD_CHECKBOX',
    REMOVE_BTN = 'REMOVE_BTN',
    REVERT_BTN = 'REVERT_BTN',
    RETURN_BTN = 'RETURN_BTN',
    REFRESH_BTN = 'REFRESH_BTN',
}

export type ActionArgsWithActionIDs = SlackActionMiddlewareArgs<BlockAction> & AllMiddlewareArgs<StringIndexed>;
export type ActionArgs = SlackActionMiddlewareArgs<SlackAction> & AllMiddlewareArgs<StringIndexed>;
