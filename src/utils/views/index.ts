import { ModalView } from '@slack/bolt';
import { Block, View } from '@slack/types';
import { ActionArgs } from 'models/actions';
import { ViewArgs, ViewArgsWithTriggerIDs } from 'models/views';

/**
 * The Window interface represents a View in the Slack bot.
 */
export interface Window {
    /**
     * This method is responsible for returning the Slack blocks, which are the UI objects needed to be rendered in the view
     */
    load(): Block | Block[] | View;
    /**
     * This method is responsible for communicating with the Slack bot and rendering it to the view
     */
    mount?<T extends ActionArgs | ViewArgs>(args: T): Promise<void>;
    /**
     * This method is responsible for displaying any updates to the view
     */
    update?(args: ViewArgs): Promise<void>;
    /**
     * This method is responsible for handling any errors that occurs within the view
     */
    handleError?(err: Error): any;
}

export interface Modal {
    /**
     * This method is responsible for returning the Slack blocks, which are the UI objects needed to be rendered in the modal
     */
    load(...args: any[]): ModalView;
    /**
     * This method is responsible for communicating with the Slack bot and rendering it to the modal
     */
    mount<T extends ViewArgsWithTriggerIDs>(args: T, ...params: any[]): Promise<void>;
}

export interface Message extends Window {
    load(): Block | Block[];
}
