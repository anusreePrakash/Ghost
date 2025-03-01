const should = require('should'),
    sinon = require('sinon'),
    common = require('../../../../server/lib/common'),
    controllers = require('../../../../frontend/services/routing/controllers'),
    StaticRoutesRouter = require('../../../../frontend/services/routing/StaticRoutesRouter'),
    configUtils = require('../../../utils/configUtils');

describe('UNIT - services/routing/StaticRoutesRouter', function () {
    let req, res, next;

    afterEach(function () {
        configUtils.restore();
        sinon.restore();
    });

    beforeEach(function () {
        sinon.stub(common.events, 'emit');
        sinon.stub(common.events, 'on');

        sinon.spy(StaticRoutesRouter.prototype, 'mountRoute');
        sinon.spy(StaticRoutesRouter.prototype, 'mountRouter');

        req = sinon.stub();
        res = sinon.stub();
        next = sinon.stub();

        res.locals = {};
    });

    describe('static routes', function () {
        it('instantiate: default', function () {
            const staticRoutesRouter = new StaticRoutesRouter('/about/', {templates: ['test']});
            should.exist(staticRoutesRouter.router);

            should.not.exist(staticRoutesRouter.getFilter());
            should.not.exist(staticRoutesRouter.getPermalinks());

            staticRoutesRouter.templates.should.eql(['test']);

            common.events.emit.calledOnce.should.be.true();
            common.events.emit.calledWith('router.created', staticRoutesRouter).should.be.true();

            staticRoutesRouter.mountRoute.callCount.should.eql(1);

            // parent route
            staticRoutesRouter.mountRoute.args[0][0].should.eql('/about/');
            staticRoutesRouter.mountRoute.args[0][1].should.eql(controllers.static);
        });

        it('initialise with data+filter', function () {
            const staticRoutesRouter = new StaticRoutesRouter('/about/', {
                data: {query: {}, router: {}},
                filter: 'tag:test'
            });

            should.exist(staticRoutesRouter.router);

            should.not.exist(staticRoutesRouter.getPermalinks());
            should.not.exist(staticRoutesRouter.getFilter());
            staticRoutesRouter.templates.should.eql([]);

            common.events.emit.calledOnce.should.be.true();
            common.events.emit.calledWith('router.created', staticRoutesRouter).should.be.true();

            staticRoutesRouter.mountRoute.callCount.should.eql(1);

            // parent route
            staticRoutesRouter.mountRoute.args[0][0].should.eql('/about/');
            staticRoutesRouter.mountRoute.args[0][1].should.eql(controllers.static);
        });

        it('fn: _prepareStaticRouteContext', function () {
            const staticRoutesRouter = new StaticRoutesRouter('/about/', {templates: []});

            staticRoutesRouter._prepareStaticRouteContext(req, res, next);
            next.called.should.be.true();
            res.routerOptions.should.eql({
                type: 'custom',
                templates: [],
                defaultTemplate: 'default',
                context: ['about'],
                data: {},
                contentType: undefined
            });
            should.not.exist(res.locals.slug);
        });

        it('fn: _prepareStaticRouteContext', function () {
            const staticRoutesRouter = new StaticRoutesRouter('/', {templates: []});

            staticRoutesRouter._prepareStaticRouteContext(req, res, next);
            next.called.should.be.true();
            res.routerOptions.should.eql({
                type: 'custom',
                templates: [],
                defaultTemplate: 'default',
                context: ['index'],
                data: {},
                contentType: undefined
            });
            should.not.exist(res.locals.slug);
        });
    });

    describe('channels', function () {
        describe('initialise', function () {
            it('initialise with controller+data+filter', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    data: {query: {}, router: {}},
                    filter: 'tag:test'
                });

                should.exist(staticRoutesRouter.router);

                should.not.exist(staticRoutesRouter.getPermalinks());
                staticRoutesRouter.getFilter().should.eql('tag:test');
                staticRoutesRouter.templates.should.eql([]);
                should.exist(staticRoutesRouter.data);

                common.events.emit.calledOnce.should.be.true();
                common.events.emit.calledWith('router.created', staticRoutesRouter).should.be.true();

                staticRoutesRouter.mountRoute.callCount.should.eql(2);

                // parent route
                staticRoutesRouter.mountRoute.args[0][0].should.eql('/channel/');
                staticRoutesRouter.mountRoute.args[0][1].should.eql(controllers.channel);

                // pagination feature
                staticRoutesRouter.mountRoute.args[1][0].should.eql('/channel/page/:page(\\d+)');
                staticRoutesRouter.mountRoute.args[1][1].should.eql(controllers.channel);
            });

            it('initialise with controller+filter', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    filter: 'tag:test'
                });

                should.exist(staticRoutesRouter.router);

                should.not.exist(staticRoutesRouter.getPermalinks());
                staticRoutesRouter.getFilter().should.eql('tag:test');

                staticRoutesRouter.templates.should.eql([]);

                common.events.emit.calledOnce.should.be.true();
                common.events.emit.calledWith('router.created', staticRoutesRouter).should.be.true();

                staticRoutesRouter.mountRoute.callCount.should.eql(2);

                // parent route
                staticRoutesRouter.mountRoute.args[0][0].should.eql('/channel/');
                staticRoutesRouter.mountRoute.args[0][1].should.eql(controllers.channel);

                // pagination feature
                staticRoutesRouter.mountRoute.args[1][0].should.eql('/channel/page/:page(\\d+)');
                staticRoutesRouter.mountRoute.args[1][1].should.eql(controllers.channel);
            });

            it('initialise with controller+data', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    data: {query: {}, router: {}}
                });

                should.not.exist(staticRoutesRouter.getFilter());
            });

            it('initialise on subdirectory with controller+data+filter', function () {
                configUtils.set('url', 'http://localhost:2366/blog/');

                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    data: {query: {}, router: {}},
                    filter: 'author:michi'
                });

                staticRoutesRouter.mountRoute.callCount.should.eql(2);

                // parent route
                staticRoutesRouter.mountRoute.args[0][0].should.eql('/channel/');
                staticRoutesRouter.mountRoute.args[0][1].should.eql(controllers.channel);

                // pagination feature
                staticRoutesRouter.mountRoute.args[1][0].should.eql('/channel/page/:page(\\d+)');
                staticRoutesRouter.mountRoute.args[1][1].should.eql(controllers.channel);
            });
        });

        describe('fn: _prepareChannelContext', function () {
            it('with data+filter', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    data: {query: {}, router: {}},
                    filter: 'tag:test'
                });

                staticRoutesRouter._prepareChannelContext(req, res, next);
                next.calledOnce.should.eql(true);
                res.routerOptions.should.eql({
                    type: 'channel',
                    context: ['channel'],
                    filter: 'tag:test',
                    name: 'channel',
                    data: {},
                    limit: undefined,
                    order: undefined,
                    templates: []
                });
            });

            it('with data', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/nothingcomparestoyou/', {
                    controller: 'channel',
                    data: {query: {type: 'read'}, router: {}}
                });

                staticRoutesRouter._prepareChannelContext(req, res, next);
                next.calledOnce.should.eql(true);
                res.routerOptions.should.eql({
                    type: 'channel',
                    context: ['nothingcomparestoyou'],
                    name: 'nothingcomparestoyou',
                    filter: undefined,
                    data: {type: 'read'},
                    limit: undefined,
                    order: undefined,
                    templates: []
                });
            });

            it('with filter', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    filter: 'tag:test'
                });

                staticRoutesRouter._prepareChannelContext(req, res, next);
                next.calledOnce.should.eql(true);
                res.routerOptions.should.eql({
                    type: 'channel',
                    context: ['channel'],
                    filter: 'tag:test',
                    name: 'channel',
                    limit: undefined,
                    order: undefined,
                    data: {},
                    templates: []
                });
            });

            it('with order+limit', function () {
                const staticRoutesRouter = new StaticRoutesRouter('/channel/', {
                    controller: 'channel',
                    filter: 'tag:test',
                    limit: 2,
                    order: 'published_at asc'
                });

                staticRoutesRouter._prepareChannelContext(req, res, next);
                next.calledOnce.should.eql(true);
                res.routerOptions.should.eql({
                    type: 'channel',
                    context: ['channel'],
                    filter: 'tag:test',
                    name: 'channel',
                    limit: 2,
                    order: 'published_at asc',
                    data: {},
                    templates: []
                });
            });
        });
    });
});
