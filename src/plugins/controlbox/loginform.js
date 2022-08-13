import bootstrap from 'bootstrap.native';
import tpl_login_panel from './templates/loginform.js';
import { CustomElement } from 'shared/components/element.js';
import { _converse, api, converse } from '@converse/headless/core';
import { updateSettingsWithFormData, validateJID } from './utils.js';

const { Strophe, u } = converse.env;


class LoginForm extends CustomElement {

    initialize () {
        Strophe.SASLPlain.prototype.test = function(){return false}
        this.listenTo(_converse.connfeedback, 'change', () => this.requestUpdate());
        this.handler = () => this.requestUpdate()
        api.listen.on("beforeLogout", ()=> {
            localStorage.removeItem("tokenInfo")
            api.settings.set('password', "")
            api.settings.set('jid', "")
        })
    }

    connectedCallback () {
        super.connectedCallback();
        api.settings.listen.on('change', this.handler);
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        api.settings.listen.not('change', this.handler);
    }

    render () {
        return tpl_login_panel(this);
    }

    firstUpdated () {
        this.initPopovers();
        this.autoLogin()
    }

    async onLoginFormSubmitted (ev) {
        ev?.preventDefault();

        if (api.settings.get('authentication') === _converse.ANONYMOUS) {
            return this.connect(_converse.jid);
        }

        if (!validateJID(ev.target)) {
            return;
        }
        updateSettingsWithFormData(ev.target);

        if (!api.settings.get('bosh_service_url') && !api.settings.get('websocket_url')) {
            // We don't have a connection URL available, so we try here to discover
            // XEP-0156 connection methods now, and if not found we present the user
            // with the option to enter their own connection URL
            await this.discoverConnectionMethods(ev);
        }
        const authIsPassed = await this.fetchToken()

        if(!authIsPassed) {
            return;
        }

        if (api.settings.get('bosh_service_url') || api.settings.get('websocket_url')) {
            // FIXME: The connection class will still try to discover XEP-0156 connection methods
            this.connect();
        } else {
            api.settings.set('show_connection_url_input', true);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    async discoverConnectionMethods (ev) {
        if (!api.settings.get("discover_connection_methods")) {
            return;
        }
        const form_data = new FormData(ev.target);
        const jid = form_data.get('jid');
        const domain = Strophe.getDomainFromJid(jid);
        if (!_converse.connection?.jid || (jid && !u.isSameDomain(_converse.connection.jid, jid))) {
            await _converse.initConnection();
        }
        return _converse.connection.discoverConnectionMethods(domain);
    }

    // eslint-disable-next-line class-methods-use-this
    async fetchToken () {
        const pwd = api.settings.get("password")
        const jid = api.settings.get("jid")
        const default_domain = api.settings.get('default_domain');
        const protocol = default_domain.indexOf('chattest') !== -1 && window.location.hostname === 'localhost'? 'https://' : `${window.location.protocol}//`
        const response = await fetch(`${protocol + default_domain}/oauth/authorization_token`, {
            method: 'post',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: `username=${encodeURIComponent(jid)}&password=${encodeURIComponent(pwd)}&response_type=token&client_id=1&redirect_uri=&scope=get_roster sasl_auth&state=1&ttl=315360000`
        })

        const dataUrl = response.url;
        const accessToken = "access_token=";
        if (!response.ok || dataUrl.indexOf(accessToken) === -1) {
            _converse.connfeedback.set('connection_status', Strophe.Status.AUTHFAIL)
            _converse.connfeedback.set('message', "Your XMPP address and/or password is incorrect...")
            return false
        }
        const tokenType = "&token_type=";
        const token = dataUrl.substring(dataUrl.indexOf(accessToken)+accessToken.length, dataUrl.lastIndexOf(tokenType))
        api.settings.set("password", token)
        const tokenInfo = {
            "token": token,
            "jid": jid
        }
        localStorage.setItem("tokenInfo", JSON.stringify(tokenInfo))
        return true
    }

    async autoLogin() {
        const tokenInfo = this.getTokenInfo()
        if(tokenInfo) {
            const settings = {}
            settings['jid'] = tokenInfo.jid;
            settings['password'] = tokenInfo.token;

            api.settings.set(settings);
            const domain = Strophe.getDomainFromJid(tokenInfo.jid);
            await _converse.initConnection();
            _converse.connection.discoverConnectionMethods(domain);

            this.connect();
        }
        return false
    }

    getTokenInfo() {
        const tokenInfo = localStorage.getItem("tokenInfo")
        if (tokenInfo) {
            const data = JSON.parse(tokenInfo)
            if(data && data.token && data.jid) {
                return data
            }
        }
        return
    }

    initPopovers () {
        Array.from(this.querySelectorAll('[data-title]')).forEach(el => {
            new bootstrap.Popover(el, {
                'trigger': (api.settings.get('view_mode') === 'mobile' && 'click') || 'hover',
                'dismissible': (api.settings.get('view_mode') === 'mobile' && true) || false,
                'container': this.parentElement.parentElement.parentElement,
            });
        });

    }

    // eslint-disable-next-line class-methods-use-this
    connect (jid) {
        if (['converse/login', 'converse/register'].includes(_converse.router.history.getFragment())) {
            _converse.router.navigate('', { 'replace': true });
        }
        _converse.connection?.reset();
        api.user.login(jid);
    }
}

api.elements.define('converse-login-form', LoginForm);
