import tpl_bookmarks_list from './templates/toggle-list.js';
import tpl_spinner from "templates/spinner.js";
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { _converse, api } from '@converse/headless/core.js';
import { initStorage } from '@converse/headless/utils/storage.js';

import '../styles/bookmarks.scss';


export default class BookmarksListView extends CustomElement {

    async initialize () {
        await api.waitUntil('bookmarksInitialized');
        const { bookmarks, chatboxes } = _converse;

        this.listenTo(bookmarks, 'add', () => this.requestUpdate());
        this.listenTo(bookmarks, 'remove', () => this.requestUpdate());

        this.listenTo(chatboxes, 'add', () => this.requestUpdate());
        this.listenTo(chatboxes, 'remove', () => this.requestUpdate());

        const id = `converse.bookmarks-list-model-${_converse.bare_jid}`;
        this.model = new Model({ id });
        initStorage(this.model, id);

        this.listenTo(this.model, 'change', () => this.requestUpdate());

        this.model.fetch({
            'success': () => this.requestUpdate(),
            'error': () => this.requestUpdate(),
        });
    }

    render () {
        return _converse.bookmarks && this.model ? tpl_bookmarks_list(this) : tpl_spinner();
    }

    toggleBookmarksList (ev) {
        ev?.preventDefault?.();
        const {CLOSED, OPENED} = _converse;
        this.model.save({
            'toggle-state': this.model.get('toggle-state') === CLOSED ? OPENED : CLOSED
        });
    }
}

api.elements.define('converse-bookmarks-list', BookmarksListView);
