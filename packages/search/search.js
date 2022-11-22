(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["converse"], factory);
    } else {
        factory(converse);
    }
}(this, function (converse) {
    var SEARCH_PERIOD = 3;// 3 months

    var SearchDialog = null, searchDialog = null, _converse, dayjs, html, _, __, Model, BootstrapModal;

    converse.plugins.add("search", {
        'dependencies': [],

        'initialize': function () {
            _converse = this._converse;
            html = converse.env.html;
            dayjs = converse.env.dayjs;
            Model = converse.env.Model;
            BootstrapModal = converse.env.BootstrapModal;
            _ = converse.env._;
            __ = _converse.__;

            class SearchResults extends _converse.CustomElement {
                static get properties () {
                    return {
                        messages: {type: Object},
                        isLoadingMsg: {type: Boolean},
                        keyword: {type: String}
                    }
                }

                render () {
                    if(this.isLoadingMsg){
                        return tpl_is_loading();
                    }
                    if(this.messages === null){
                        return;
                    }
                    return tpl_search_results(this.messages, this.keyword);
                }

            }
            function tpl_search_results(messages, keyword) {
                const tagRegExp = new RegExp("(\\b" + keyword + "\\b)", "im");
                return html`
                    <table>
                        <tr>
                            <th>Date</th>
                            <th>Person</th>
                            <th>Message</th>
                        </tr>
                        ${messages.map(function (msg) {
                            const body = msg.querySelector('body').innerHTML;
                            const delay = msg.querySelector('forwarded').querySelector('delay');
                            const from = msg.querySelector('forwarded').querySelector('message').getAttribute('from');
                            const time = delay ? delay.getAttribute('stamp') : dayjs().format();
                            const pretty_time = dayjs(time).format('MMM DD HH:mm:ss');
                            const pretty_from = from.split("/")[1];
                            const msgId = msg.querySelector('message').getAttribute('id');
                            //var tagged = tagRegExp ? body.replace(tagRegExp, html`<span style=background-color:#FF9;color:#555;>$1</span>`) : body;
                            return html`
                                <tr style="cursor: pointer;" data-id="${msgId}">
                                    <td>${pretty_time}</td>
                                    <td>${pretty_from}</td>
                                    <td>${body}</td>
                                </tr>`
                        })}
                    </table>`;
            }

            function tpl_is_loading(){
                return html`Loading...`;
            }

            _converse.api.elements.define('search-results-table', SearchResults);


            SearchDialog = BootstrapModal.extend({
                id: "plugin-search-modal",
                initialize() {
                    BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.listenTo(this.model, 'change', this.render);
                    this.model.set('isLoadingMsg', false);
                    this.model.set('messages', null);
                },
                toHTML() {
                    return html`<div class="modal-dialog modal-xl" role="document">
                        <div class="modal-content">
                         <div class="modal-header">
                             <h1 class="modal-title" id="converse-plugin-search-label">Search</h1>
                             <button type="button" class="close" data-dismiss="modal">&times;</button>
                         </div>
                         <div class="modal-body">
                             <form class="converse-form">
                                 <div class="form-group">
                                    <input value="${this.model.get('keyword') || ''}" id="pade-search-keywords" class="form-control" type="text" placeholder="Type a query and press [Enter] to search" />
                                 </div>
                                 <div class="form-group">
                                     <input id="search-nick" class="form-control" type="text" placeholder="Search by nick" >
                                 </div>
                             </form>
                             <p/>
                             <div id="pade-search-results">
                               <search-results-table .keyword="${this.model.get("keyword")}" .messages="${this.model.get('messages')}" ?isLoadingMsg="${this.model.get('isLoadingMsg')}"></search-results-table>
                             </div>
                         </div>
                         <div class="modal-footer">
                            <button type="button" class="btn btn-primary btn-search">Search</button>
                             <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button> </div>
                         </div>
                        </div> 
                    </div>`;
                },
                afterRender() {
                    var that = this;
                    this.el.addEventListener('shown.bs.modal', function()
                    {
                        if (that.model.get("keyword"))
                        {
                            that.el.querySelector('#pade-search-keywords').value = that.model.get("keyword");
                            that.doSearch();
                        }
                        else {
                            that.el.querySelector('#pade-search-keywords').focus();
                        }

                    }, false);
                },
                events: {
                    'click .btn-search': 'search',
                    'keyup #pade-search-keywords': 'keyUp',
                    'keyup #search-nick': 'keyUp',
                    'click #pade-search-results tr': 'clickResultMsg'
                },

                keyUp(ev) {
                    if (ev.key === "Enter")
                    {
                        this.search();
                    }
                },

                search() {
                    const keyword = this.el.querySelector("#pade-search-keywords").value.trim();
                    const searchNick = this.el.querySelector("#search-nick").value.trim();
                    this.model.set("keyword", keyword)
                    this.model.set("searchNick", searchNick)
                    this.doSearch();
                },

                clickResultMsg(ev) {
                    const msg = ev.delegateTarget;
                    const msgId = msg.dataset.id;

                    if(msgId) {
                        const view = this.model.get('view');
                        const jid = view.model.get('jid');

                        _converse.api.trigger('focusOnMessage',{msgId, jid});
                        this.modal.hide();
                    }
                },

                doSearch() {
                    const view = this.model.get("view");
                    const jid = view.model.get("jid");
                    const groupchat = view.model.get("type") == "chatroom";
                    const method = _converse.api.settings.get("search_method");

                    const that = this;
                    const keyword = that.model.get("keyword");
                    const searchNick = that.model.get("searchNick");
                    let searchRegExp;

                    console.debug("doSearch", keyword, jid);

                    if (keyword != '') {
                        searchRegExp = new RegExp('^(.*)(\s?' + keyword + ')', 'im');
                    }

                    that.model.set('isLoadingMsg', true);

                    if (method == "mam") {
                        const opt = {before: '', max: 999, 'groupchat': groupchat, 'with': jid};

                        if(searchNick){
                            opt['with_nick'] = searchNick;
                            opt['start'] = getSearchPeriod();
                        }
                        _converse.api.archive.query(opt).then(function(result) {
                            that.model.set('isLoadingMsg', false);

                            const messages = result.messages.filter(function (msg){
                                const msgBody = msg.querySelector('body');
                                if (!msgBody){
                                    return false;
                                }
                                const body = msgBody.innerHTML;
                                return !searchRegExp || searchRegExp.test(body);
                            });

                            that.model.set('messages', messages);
                        }).catch(function (){
                            that.model.set('isLoadingMsg', false);
                        });
                    }
                }
            });

            _converse.api.settings.extend({
                search_method: 'mam'         // use values mam or local
            });

            _converse.api.listen.on('getToolbarButtons', function(toolbar_el, buttons)
            {
                console.debug("getToolbarButtons", toolbar_el.model.get("jid"));
                let color = "fill:var(--chat-toolbar-btn-color);";
                if (toolbar_el.model.get("type") == "chatroom") color = "fill:var(--muc-toolbar-btn-color);";

                buttons.push(html`
                    <button class="plugin-search" title="${__('Search conversations for keywords')}" @click=${performSearch}/>
                        <svg style="width:18px; height:18px; ${color}" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 32 32" enable-background="new 0 0 16 16" xml:space="preserve"> <g><path d="M 2,30l 18,0 c 1.104,0, 2-0.896, 2-2l0-2.7 c 0.426-0.204, 0.824-0.448, 1.198-0.73l 6.138,6.138 c 0.196,0.196, 0.452,0.292, 0.708,0.292s 0.512-0.098, 0.708-0.292c 0.39-0.39, 0.39-1.024,0-1.414l-6.142-6.142 C 25.472,21.988, 26,20.56, 26,19c0-2.788-1.642-5.174-4-6.3L 22,2 c0-1.104-0.896-2-2-2L 2,0 C 0.896,0,0,0.896,0,2l0,26 C0,29.104, 0.896,30, 2,30z M 19,24C 16.244,24, 14,21.756, 14,19S 16.244,14, 19,14S 24,16.244, 24,19S 21.756,24, 19,24z M 2,2l 18,0 l0,10 L 5.286,12 C 4.576,12, 4,12.448, 4,13C 4,13.552, 4.576,14, 5.286,14l 8.826,0 C 13.038,15.048, 12.326,16.444, 12.1,18L 5,18 C 4.448,18, 4,18.448, 4,19 C 4,19.552, 4.448,20, 5,20l 7.1,0 c 0.49,3.388, 3.376,6, 6.9,6c 0.342,0, 0.67-0.054, 1-0.1L 20,28 L 2,28 L 2,2 zM 5,8l 12,0 C 17.552,8, 18,7.552, 18,7C 18,6.448, 17.552,6, 17,6l-12,0 C 4.448,6, 4,6.448, 4,7C 4,7.552, 4.448,8, 5,8z"></path></g></svg>
                    </button>
                `);

                return buttons;
            });

            console.debug("search plugin is ready");
        },

        'overrides': {
            ChatBoxView: {
                parseMessageForCommands: function(text) {
                    console.debug('search - parseMessageForCommands', text);

                    const match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''];
                    const command = match[1].toLowerCase();

                    if (command === "search" && match[2])
                    {
                        searchDialog = new SearchDialog({ 'model': new converse.env.Model({view: this, keyword: match[2]}) });
                        searchDialog.model.set("keyword", match[2]);
                        searchDialog.show();
                        return true;
                    }
                    else

                        return this.__super__.parseMessageForCommands.apply(this, arguments);
                }
            }
        }
    });

    function getSearchPeriod(){
        var date = new Date();

        date.setMonth(date.getMonth() - SEARCH_PERIOD);
        date.setHours(0, 0, 0, 0);

        return date.toISOString();

    }

    function performSearch(ev)
    {
        ev.stopPropagation();
        ev.preventDefault();

        const toolbar_el = converse.env.utils.ancestor(ev.target, 'converse-chat-toolbar');
        const chatview = _converse.chatboxviews.get(toolbar_el.model.get('jid'));

        searchDialog = new SearchDialog({ 'model': new Model({view: chatview}) });
        searchDialog.model.set("keyword", null);
        searchDialog.show(ev);
    }

}));