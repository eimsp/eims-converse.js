import './message-history';
import tpl_spinner from "templates/spinner.js";
import { CustomElement } from 'shared/components/element.js';
import {_converse, api} from '@converse/headless/core';
import { html } from 'lit';
import { markScrolled } from './utils.js';

import './styles/chat-content.scss';
import { fetchMessagesOnScrollUp } from '../../plugins/mam-views/utils';

const MAX_WAIT_FOR_RESPONSE = 2*1000;
const CHECK_RESPONSE_TIMEOUT = 400;


export default class ChatContent extends CustomElement {

    static get properties () {
        return {
            jid: { type: String }
        }
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        this.removeEventListener('scroll', markScrolled);
        api.listen.not('focusOnMessage', this.focusOnMessageHandler);
    }

    async initialize () {
        await this.setModels();
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'add', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'change', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'remove', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'rendered', () => this.requestUpdate());
        this.listenTo(this.model.messages, 'reset', () => this.requestUpdate());
        this.listenTo(this.model.notifications, 'change', () => this.requestUpdate());
        this.listenTo(this.model.ui, 'change', () => this.requestUpdate());
        this.listenTo(this.model.ui, 'change:scrolled', this.scrollDown);

        this.focusOnMessageHistoty = {};

        this.focusOnMessageHandler = data => {
            console.log('focusOnMessage', data);
            if (this.model.get('jid') !== data.jid) {
                return;
            }
            const scrollData = this.focusOnMessageHistoty[data.msgId];
            if (!scrollData) {
                /*
                {
                    prevFetchTime: int,
                    prevMsgLength: int
                }
                 */
                this.focusOnMessageHistoty[data.msgId] = {};
            }
            this.focusOnMessage(data);
        };

        api.listen.on('focusOnMessage', this.focusOnMessageHandler);


        if (this.model.occupants) {
            this.listenTo(this.model.occupants, 'change', () => this.requestUpdate());
        }
        this.addEventListener('scroll', markScrolled);
    }

    async setModels () {
        this.model = await api.chatboxes.get(this.jid);
        await this.model.initialized;
        this.requestUpdate();
    }

    render () {
        if (!this.model) {
            return '';
        }
        // This element has "flex-direction: reverse", so elements here are
        // shown in reverse order.
        return html`
            <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
            <converse-message-history
                .model=${this.model}
                .messages=${[...this.model.messages.models]}>
            </converse-message-history>
            ${ this.model.ui?.get('chat-content-spinner-top') ? tpl_spinner() : '' }
        `;
    }

    async focusOnMessage(data) {
        const requestDataInform = this.focusOnMessageHistoty[data.msgId];
        console.log("requestDataInform:", requestDataInform);

        const messages = this.model.messages;
        const msg = messages.models.find(m => m.get('msgid') === data.msgId);
        if (msg) {
            console.log('Go to the message');
            _converse.router.history.navigate(`#${data.msgId}`);
        } else {
            //fetch first time or messages were already received but without the expected message
            console.log("messages", this.model.messages.length);
            if(!requestDataInform.prevFetchTime || (this.model.messages.length > requestDataInform.prevMsgLength)){
                console.log('Reset data and fetch next messages');
                this.resetData(requestDataInform);
                await fetchMessagesOnScrollUp(this);
            }

            const currentTime = Date.now();
            //check the response after CHECK_RESPONSE_TIMEOUT in case if the last fetch was less than MAX_WAIT_FOR_RESPONSE
            if((currentTime - requestDataInform.prevFetchTime) < MAX_WAIT_FOR_RESPONSE ) {
                console.log("Check after ", CHECK_RESPONSE_TIMEOUT)
                setTimeout(() => {
                    this.focusOnMessage(data);
                }, CHECK_RESPONSE_TIMEOUT)
            }

        }
    }

    resetData(requestDataInform) {
        requestDataInform.prevFetchTime = Date.now()
        requestDataInform.prevMsgLength = this.model.messages.length
    }


    scrollDown () {
        if (this.model.ui.get('scrolled')) {
            return;
        }
        if (this.scrollTo) {
            const behavior = this.scrollTop ? 'smooth' : 'auto';
            this.scrollTo({ 'top': 0, behavior });
        } else {
            this.scrollTop = 0;
        }
        /**
         * Triggered once the converse-chat-content element has been scrolled down to the bottom.
         * @event _converse#chatBoxScrolledDown
         * @type {object}
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox - The chat model
         * @example _converse.api.listen.on('chatBoxScrolledDown', obj => { ... });
         */
        api.trigger('chatBoxScrolledDown', { 'chatbox': this.model });
    }
}

api.elements.define('converse-chat-content', ChatContent);
