var should = require('should'),
    sinon = require('sinon'),
    testUtils = require('../../utils'),
    moment = require('moment'),
    _ = require('lodash'),
    Promise = require('bluebird'),
    sequence = require('../../../server/lib/promise/sequence'),
    urlService = require('../../../frontend/services/url'),
    ghostBookshelf = require('../../../server/models/base'),
    models = require('../../../server/models'),
    settingsCache = require('../../../server/services/settings/cache'),
    common = require('../../../server/lib/common'),
    configUtils = require('../../utils/configUtils'),
    DataGenerator = testUtils.DataGenerator,
    context = testUtils.context.owner,
    markdownToMobiledoc = testUtils.DataGenerator.markdownToMobiledoc;

/**
 * IMPORTANT:
 * - do not spy the events unit, because when we only spy, all listeners get the event
 * - this can cause unexpected behaviour as the listeners execute code
 * - using rewire is not possible, because each model self registers it's model registry in bookshelf
 * - rewire would add 1 registry, a file who requires the models, tries to register the model another time
 */
describe('Post Model', function () {
    var eventsTriggered = {};
    before(function () {
        testUtils.setup('users:roles');
        testUtils.teardown();
        testUtils.stopGhost();
        testUtils.teardown();
    });
    afterEach(function () {
        sinon.restore();
    });

    beforeEach(function () {
        sinon.stub(urlService, 'getUrlByResourceId').withArgs(testUtils.DataGenerator.Content.posts[0].id).returns('/html-ipsum/');
    });

    describe('Single author posts', function () {
        afterEach(function () {
            configUtils.restore();
        });

        describe('fetchOne/fetchAll/fetchPage', function () {
            before(testUtils.fixtures.insertPostsAndTags);
            after(function () {
                return testUtils.truncate('posts_tags')
                    .then(function () {
                        return testUtils.truncate('tags');
                    })
                    .then(function () {
                        return testUtils.truncate('posts');
                    });
            });

            describe('findPage', function () {
                // @TODO: this test case fails for mysql currently if you run all regression tests, the test does not fail if you run this as a single test
                describe.skip('with more posts/tags', function () {
                    beforeEach(function () {
                        testUtils.truncate('posts_tags')
                            .then(function () {
                                return testUtils.truncate('tags');
                            })
                            .then(function () {
                                return testUtils.truncate('posts');
                            });
                        testUtils.fixtures.insertPostsAndTags()
                            .then(function () {
                                return testUtils.fixtures.insertExtraPosts();
                            })
                            .then(function () {
                                return testUtils.fixtures.insertExtraPostsTags();
                            });
                    });

                    it('can findPage, with various options', function (done) {
                        models.Post.findPage({page: 2})
                            .then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(2);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(4);
                                paginationResult.data.length.should.equal(15);

                                return models.Post.findPage({page: 5});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(5);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(4);
                                paginationResult.data.length.should.equal(0);

                                return models.Post.findPage({limit: 30});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(30);
                                paginationResult.meta.pagination.pages.should.equal(2);
                                paginationResult.data.length.should.equal(30);

                                // Test both boolean formats
                                return models.Post.findPage({limit: 10, staticPages: true});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(10);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(1);

                                // Test both boolean formats
                                return models.Post.findPage({limit: 10, staticPages: '1'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(10);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(1);

                                // Test featured pages
                                return models.Post.findPage({limit: 10, filter: 'featured:true'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(10);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(2);

                                // Test both boolean formats for featured pages
                                return models.Post.findPage({limit: 10, filter: 'featured:1'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(10);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(2);

                                return models.Post.findPage({limit: 10, page: 2, status: 'all'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.pages.should.equal(11);

                                return models.Post.findPage({limit: 'all', status: 'all'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal('all');
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(108);

                                done();
                            }).catch(done);
                    });

                    it('can findPage for tag, with various options', function (done) {
                        // Test tag filter
                        models.Post.findPage({page: 1, filter: 'tags:bacon'})
                            .then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(2);

                                return models.Post.findPage({page: 1, filter: 'tags:kitchen-sink'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(1);
                                paginationResult.data.length.should.equal(2);

                                return models.Post.findPage({page: 1, filter: 'tags:injection'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(1);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(2);
                                paginationResult.data.length.should.equal(15);

                                return models.Post.findPage({page: 2, filter: 'tags:injection'});
                            }).then(function (paginationResult) {
                                paginationResult.meta.pagination.page.should.equal(2);
                                paginationResult.meta.pagination.limit.should.equal(15);
                                paginationResult.meta.pagination.pages.should.equal(2);
                                paginationResult.data.length.should.equal(10);

                                done();
                            }).catch(done);
                    });
                });
            });
        });

        describe('edit', function () {
            afterEach(function () {
                return testUtils.truncate('posts_tags')
                    .then(function () {
                        return testUtils.truncate('tags');
                    })
                    .then(function () {
                        return testUtils.truncate('posts');
                    });
            });

            beforeEach(function () {
                testUtils.fixtures.insertPostsAndTags();
                eventsTriggered = {};

                sinon.stub(common.events, 'emit').callsFake(function (eventName, eventObj) {
                    if (!eventsTriggered[eventName]) {
                        eventsTriggered[eventName] = [];
                    }

                    eventsTriggered[eventName].push(eventObj);
                });
            });

            it('[failure] multiple edits in one transaction', function () {
                const options = _.cloneDeep(context),
                    data = {
                        status: 'published'
                    };

                return models.Base.transaction(function (txn) {
                    options.transacting = txn;

                    return models.Post.edit(data, _.merge({id: testUtils.DataGenerator.Content.posts[3].id}, options))
                        .then(function () {
                            return models.Post.edit(data, _.merge({id: testUtils.DataGenerator.Content.posts[5].id}, options));
                        })
                        .then(function () {
                            // force rollback
                            throw new Error();
                        });
                }).catch(function () {
                    // txn was rolled back
                    Object.keys(eventsTriggered).length.should.eql(0);
                });
            });

            it('multiple edits in one transaction', function () {
                const options = _.cloneDeep(context),
                    data = {
                        status: 'published'
                    };

                return models.Base.transaction(function (txn) {
                    options.transacting = txn;

                    return models.Post.edit(data, _.merge({id: testUtils.DataGenerator.Content.posts[3].id}, options))
                        .then(function () {
                            return models.Post.edit(data, _.merge({id: testUtils.DataGenerator.Content.posts[5].id}, options));
                        });
                }).then(function () {
                    // txn was successful
                    Object.keys(eventsTriggered).length.should.eql(4);
                });
            });

            it('can change title', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[0].id;

                models.Post.findOne({id: postId}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.title.should.not.equal('new title');

                    return models.Post.edit({title: 'new title'}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.title.should.equal('new title');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.published.edited']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('[failure] custom excerpt soft limit reached', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[0].id;

                models.Post.findOne({id: postId}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);

                    return models.Post.edit({
                        custom_excerpt: new Array(302).join('a')
                    }, _.extend({}, context, {id: postId}));
                }).then(function () {
                    done(new Error('expected validation error'));
                }).catch(function (err) {
                    (err[0] instanceof common.errors.ValidationError).should.eql(true);
                    done();
                });
            });

            it('can publish draft post', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[3].id;

                models.Post.findOne({id: postId, status: 'draft'}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('draft');

                    return models.Post.edit({status: 'published'}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.published']);
                    should.exist(eventsTriggered['post.edited']);
                    should.exist(eventsTriggered['tag.attached']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('can unpublish published post', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[0].id;

                models.Post.findOne({id: postId}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('published');

                    return models.Post.edit({status: 'draft'}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('draft');

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.unpublished']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('draft -> scheduled without published_at update', function (done) {
                var post;

                models.Post.findOne({status: 'draft'}).then(function (results) {
                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('draft');

                    results.set('published_at', null);
                    return results.save();
                }).then(function () {
                    return models.Post.edit({
                        status: 'scheduled'
                    }, _.extend({}, context, {id: post.id}));
                }).then(function () {
                    done(new Error('expected error'));
                }).catch(function (err) {
                    should.exist(err);
                    (err instanceof common.errors.ValidationError).should.eql(true);
                    done();
                });
            });

            it('draft -> scheduled: expect update of published_at', function (done) {
                var newPublishedAt = moment().add(1, 'day').toDate();

                models.Post.findOne({status: 'draft'}).then(function (results) {
                    var post;

                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('draft');

                    return models.Post.edit({
                        status: 'scheduled',
                        published_at: newPublishedAt
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');

                    // mysql does not store ms
                    moment(edited.attributes.published_at).startOf('seconds').diff(moment(newPublishedAt).startOf('seconds')).should.eql(0);

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.scheduled']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('scheduled -> draft: expect unschedule', function (done) {
                models.Post.findOne({status: 'scheduled'}).then(function (results) {
                    var post;

                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('scheduled');

                    return models.Post.edit({
                        status: 'draft'
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('draft');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.unscheduled']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('scheduled -> scheduled with updated published_at', function (done) {
                models.Post.findOne({status: 'scheduled'}).then(function (results) {
                    var post;

                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('scheduled');

                    return models.Post.edit({
                        status: 'scheduled',
                        published_at: moment().add(20, 'days').toDate()
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.rescheduled']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('scheduled -> scheduled with unchanged published_at', function (done) {
                models.Post.findOne({status: 'scheduled'}).then(function (results) {
                    var post;

                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('scheduled');

                    return models.Post.edit({
                        status: 'scheduled'
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');

                    // nothing has changed
                    Object.keys(eventsTriggered).length.should.eql(0);

                    done();
                }).catch(done);
            });

            it('scheduled -> scheduled with unchanged published_at (within the 2 minutes window)', function (done) {
                var post;

                models.Post.findOne({status: 'scheduled'}).then(function (results) {
                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('scheduled');

                    results.set('published_at', moment().add(2, 'minutes').add(2, 'seconds').toDate());
                    return results.save();
                }).then(function () {
                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.edited']);
                    should.exist(eventsTriggered['post.rescheduled']);
                    eventsTriggered = {};

                    return Promise.delay(1000 * 3);
                }).then(function () {
                    return models.Post.edit({
                        status: 'scheduled'
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');

                    Object.keys(eventsTriggered).length.should.eql(1);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('published -> scheduled and expect update of published_at', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[0].id;

                models.Post.findOne({id: postId}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('published');

                    return models.Post.edit({
                        status: 'scheduled',
                        published_at: moment().add(1, 'day').toDate()
                    }, _.extend({}, context, {id: postId}));
                }).then(function () {
                    done(new Error('change status from published to scheduled is not allowed right now!'));
                }).catch(function (err) {
                    should.exist(err);
                    (err instanceof common.errors.ValidationError).should.eql(true);
                    done();
                });
            });

            it('can convert draft post to page and back', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[3].id;

                models.Post.findOne({id: postId, status: 'draft'}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('draft');

                    return models.Post.edit({page: 1}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('draft');
                    edited.attributes.page.should.equal(true);

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['page.added']);

                    return models.Post.edit({page: 0}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('draft');
                    edited.attributes.page.should.equal(false);

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['page.added']);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['post.added']);

                    done();
                }).catch(done);
            });

            it('can convert draft to schedule AND post to page and back', function (done) {
                models.Post.findOne({status: 'draft'}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.status.should.equal('draft');

                    return models.Post.edit({
                        page: 1,
                        status: 'scheduled',
                        published_at: moment().add(10, 'days')
                    }, _.extend({}, context, {id: post.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');
                    edited.attributes.page.should.equal(true);

                    Object.keys(eventsTriggered).length.should.eql(3);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['page.added']);
                    should.exist(eventsTriggered['page.scheduled']);

                    return models.Post.edit({page: 0}, _.extend({}, context, {id: edited.id}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('scheduled');
                    edited.attributes.page.should.equal(false);

                    Object.keys(eventsTriggered).length.should.eql(7);
                    should.exist(eventsTriggered['page.unscheduled']);
                    should.exist(eventsTriggered['page.deleted']);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['post.scheduled']);

                    done();
                }).catch(done);
            });

            it('can convert published post to page and back', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[0].id;

                models.Post.findOne({id: postId}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('published');

                    return models.Post.edit({page: 1}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');
                    edited.attributes.page.should.equal(true);

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.unpublished']);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['page.added']);
                    should.exist(eventsTriggered['page.published']);

                    return models.Post.edit({page: 0}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');
                    edited.attributes.page.should.equal(false);

                    Object.keys(eventsTriggered).length.should.eql(8);
                    should.exist(eventsTriggered['page.unpublished']);
                    should.exist(eventsTriggered['page.deleted']);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['post.published']);

                    done();
                }).catch(done);
            });

            it('can change type and status at the same time', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[3].id;

                models.Post.findOne({id: postId, status: 'draft'}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('draft');

                    return models.Post.edit({page: 1, status: 'published'}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');
                    edited.attributes.page.should.equal(true);

                    Object.keys(eventsTriggered).length.should.eql(5);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['page.added']);
                    should.exist(eventsTriggered['page.published']);
                    should.exist(eventsTriggered['tag.attached']);
                    should.exist(eventsTriggered['user.attached']);

                    return models.Post.edit({page: 0, status: 'draft'}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('draft');
                    edited.attributes.page.should.equal(false);

                    Object.keys(eventsTriggered).length.should.eql(8);
                    should.exist(eventsTriggered['page.unpublished']);
                    should.exist(eventsTriggered['page.deleted']);
                    should.exist(eventsTriggered['post.added']);

                    done();
                }).catch(done);
            });

            it('cannot override the published_by setting', function (done) {
                var postId = testUtils.DataGenerator.Content.posts[3].id;

                models.Post.findOne({id: postId, status: 'draft'}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(postId);
                    post.status.should.equal('draft');

                    // Test changing status and published_by at the same time
                    return models.Post.edit({
                        status: 'published',
                        published_by: 4
                    }, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');
                    edited.attributes.published_by.should.equal(context.context.user);

                    // Test changing status and published_by on its own
                    return models.Post.edit({published_by: 4}, _.extend({}, context, {id: postId}));
                }).then(function (edited) {
                    should.exist(edited);
                    edited.attributes.status.should.equal('published');
                    edited.attributes.published_by.should.equal(context.context.user);

                    done();
                }).catch(done);
            });
        });

        describe('add', function () {
            before(testUtils.fixtures.insertPostsAndTags);

            after(function () {
                return testUtils.truncate('posts_tags')
                    .then(function () {
                        return testUtils.truncate('tags');
                    })
                    .then(function () {
                        return testUtils.truncate('posts');
                    });
            });

            beforeEach(function () {
                eventsTriggered = {};

                sinon.stub(common.events, 'emit').callsFake(function (eventName, eventObj) {
                    if (!eventsTriggered[eventName]) {
                        eventsTriggered[eventName] = [];
                    }

                    eventsTriggered[eventName].push(eventObj);
                });
            });

            it('can add, defaults are all correct', function (done) {
                var createdPostUpdatedDate,
                    newPost = testUtils.DataGenerator.forModel.posts[2],
                    newPostDB = testUtils.DataGenerator.Content.posts[2];

                models.Post.add(newPost, _.merge({withRelated: ['author']}, context)).then(function (createdPost) {
                    return models.Post.findOne({id: createdPost.id, status: 'all'});
                }).then(function (createdPost) {
                    should.exist(createdPost);
                    createdPost.has('uuid').should.equal(true);
                    createdPost.get('status').should.equal('draft');
                    createdPost.get('title').should.equal(newPost.title, 'title is correct');
                    createdPost.get('mobiledoc').should.equal(newPost.mobiledoc, 'mobiledoc is correct');
                    createdPost.has('html').should.equal(true);
                    createdPost.get('html').should.equal(newPostDB.html);
                    createdPost.has('plaintext').should.equal(true);
                    createdPost.get('plaintext').should.match(/^testing/);
                    createdPost.get('slug').should.equal(newPostDB.slug + '-2');
                    (!!createdPost.get('featured')).should.equal(false);
                    (!!createdPost.get('page')).should.equal(false);

                    should.equal(createdPost.get('locale'), null);
                    should.equal(createdPost.get('visibility'), 'public');

                    // testing for nulls
                    (createdPost.get('feature_image') === null).should.equal(true);
                    (createdPost.get('meta_title') === null).should.equal(true);
                    (createdPost.get('meta_description') === null).should.equal(true);

                    createdPost.get('created_at').should.be.above(new Date(0).getTime());
                    createdPost.get('created_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    createdPost.get('author_id').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    createdPost.has('author').should.equal(false);
                    createdPost.get('created_by').should.equal(createdPost.get('author_id'));
                    createdPost.get('updated_at').should.be.above(new Date(0).getTime());
                    createdPost.get('updated_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    should.equal(createdPost.get('published_at'), null);
                    should.equal(createdPost.get('published_by'), null);

                    createdPostUpdatedDate = createdPost.get('updated_at');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    // Set the status to published to check that `published_at` is set.
                    return createdPost.save({status: 'published'}, context);
                }).then(function (publishedPost) {
                    publishedPost.get('published_at').should.be.instanceOf(Date);
                    publishedPost.get('published_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    publishedPost.get('updated_at').should.be.instanceOf(Date);
                    publishedPost.get('updated_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    publishedPost.get('updated_at').should.not.equal(createdPostUpdatedDate);

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.published']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('can add, default visibility is taken from settings cache', function (done) {
                var originalSettingsCacheGetFn = settingsCache.get;
                sinon.stub(settingsCache, 'get').callsFake(function (key, options) {
                    if (key === 'labs') {
                        return {
                            members: true,
                            default_content_visibility: 'paid'
                        };
                    }

                    return originalSettingsCacheGetFn(key, options);
                });

                var createdPostUpdatedDate,
                    newPost = testUtils.DataGenerator.forModel.posts[2],
                    newPostDB = testUtils.DataGenerator.Content.posts[2];

                models.Post.add(newPost, _.merge({withRelated: ['author']}, context)).then(function (createdPost) {
                    return models.Post.findOne({id: createdPost.id, status: 'all'});
                }).then(function (createdPost) {
                    should.exist(createdPost);
                    createdPost.has('uuid').should.equal(true);
                    createdPost.get('status').should.equal('draft');
                    createdPost.get('title').should.equal(newPost.title, 'title is correct');
                    createdPost.get('mobiledoc').should.equal(newPost.mobiledoc, 'mobiledoc is correct');
                    createdPost.has('html').should.equal(true);
                    createdPost.get('html').should.equal(newPostDB.html);
                    createdPost.has('plaintext').should.equal(true);
                    createdPost.get('plaintext').should.match(/^testing/);
                    createdPost.get('slug').should.equal(newPostDB.slug + '-2');
                    (!!createdPost.get('featured')).should.equal(false);
                    (!!createdPost.get('page')).should.equal(false);

                    should.equal(createdPost.get('locale'), null);
                    should.equal(createdPost.get('visibility'), 'paid');

                    // testing for nulls
                    (createdPost.get('feature_image') === null).should.equal(true);
                    (createdPost.get('meta_title') === null).should.equal(true);
                    (createdPost.get('meta_description') === null).should.equal(true);

                    createdPost.get('created_at').should.be.above(new Date(0).getTime());
                    createdPost.get('created_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    createdPost.get('author_id').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    createdPost.has('author').should.equal(false);
                    createdPost.get('created_by').should.equal(createdPost.get('author_id'));
                    createdPost.get('updated_at').should.be.above(new Date(0).getTime());
                    createdPost.get('updated_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    should.equal(createdPost.get('published_at'), null);
                    should.equal(createdPost.get('published_by'), null);

                    createdPostUpdatedDate = createdPost.get('updated_at');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    // Set the status to published to check that `published_at` is set.
                    return createdPost.save({status: 'published'}, context);
                }).then(function (publishedPost) {
                    publishedPost.get('published_at').should.be.instanceOf(Date);
                    publishedPost.get('published_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    publishedPost.get('updated_at').should.be.instanceOf(Date);
                    publishedPost.get('updated_by').should.equal(testUtils.DataGenerator.Content.users[0].id);
                    publishedPost.get('updated_at').should.not.equal(createdPostUpdatedDate);

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.published']);
                    should.exist(eventsTriggered['post.edited']);

                    done();
                }).catch(done);
            });

            it('can add, with previous published_at date', function (done) {
                var previousPublishedAtDate = new Date(2013, 8, 21, 12);

                models.Post.add({
                    status: 'published',
                    published_at: previousPublishedAtDate,
                    title: 'published_at test',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).then(function (newPost) {
                    should.exist(newPost);
                    new Date(newPost.get('published_at')).getTime().should.equal(previousPublishedAtDate.getTime());

                    Object.keys(eventsTriggered).length.should.eql(3);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['post.published']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('add draft post without published_at -> we expect no auto insert of published_at', function (done) {
                models.Post.add({
                    status: 'draft',
                    title: 'draft 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).then(function (newPost) {
                    should.exist(newPost);
                    should.not.exist(newPost.get('published_at'));

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('add multiple authors', function (done) {
                models.Post.add({
                    status: 'draft',
                    title: 'draft 1',
                    mobiledoc: markdownToMobiledoc('This is some content'),
                    authors: [{
                        id: testUtils.DataGenerator.forKnex.users[0].id,
                        name: testUtils.DataGenerator.forKnex.users[0].name
                    }]
                }, _.merge({withRelated: ['authors']}, context)).then(function (newPost) {
                    should.exist(newPost);
                    newPost.toJSON().author.should.eql(testUtils.DataGenerator.forKnex.users[0].id);
                    newPost.toJSON().authors.length.should.eql(1);
                    newPost.toJSON().authors[0].id.should.eql(testUtils.DataGenerator.forKnex.users[0].id);
                    done();
                }).catch(done);
            });

            it('add draft post with published_at -> we expect published_at to exist', function (done) {
                models.Post.add({
                    status: 'draft',
                    published_at: moment().toDate(),
                    title: 'draft 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).then(function (newPost) {
                    should.exist(newPost);
                    should.exist(newPost.get('published_at'));

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('add scheduled post without published_at -> we expect an error', function (done) {
                models.Post.add({
                    status: 'scheduled',
                    title: 'scheduled 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).catch(function (err) {
                    should.exist(err);
                    (err instanceof common.errors.ValidationError).should.eql(true);
                    Object.keys(eventsTriggered).length.should.eql(0);
                    done();
                });
            });

            it('add scheduled post with published_at not in future-> we expect an error', function (done) {
                models.Post.add({
                    status: 'scheduled',
                    published_at: moment().subtract(1, 'minute'),
                    title: 'scheduled 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).catch(function (err) {
                    should.exist(err);
                    (err instanceof common.errors.ValidationError).should.eql(true);
                    Object.keys(eventsTriggered).length.should.eql(0);
                    done();
                });
            });

            it('add scheduled post with published_at 1 minutes in future -> we expect an error', function (done) {
                models.Post.add({
                    status: 'scheduled',
                    published_at: moment().add(1, 'minute'),
                    title: 'scheduled 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).catch(function (err) {
                    (err instanceof common.errors.ValidationError).should.eql(true);
                    Object.keys(eventsTriggered).length.should.eql(0);
                    done();
                });
            });

            it('add scheduled post with published_at 10 minutes in future -> we expect success', function (done) {
                models.Post.add({
                    status: 'scheduled',
                    published_at: moment().add(10, 'minute'),
                    title: 'scheduled 1',
                    mobiledoc: markdownToMobiledoc('This is some content')
                }, context).then(function (post) {
                    should.exist(post);

                    Object.keys(eventsTriggered).length.should.eql(3);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['post.scheduled']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('can generate a non conflicting slug', function (done) {
                // Create 12 posts with the same title
                sequence(_.times(12, function (i) {
                    return function () {
                        return models.Post.add({
                            title: 'Test Title',
                            mobiledoc: markdownToMobiledoc('Test Content ' + (i + 1))
                        }, context);
                    };
                })).then(function (createdPosts) {
                    // Should have created 12 posts
                    createdPosts.length.should.equal(12);

                    // Should have unique slugs and contents
                    _(createdPosts).each(function (post, i) {
                        var num = i + 1;

                        // First one has normal title
                        if (num === 1) {
                            post.get('slug').should.equal('test-title');
                            return;
                        }

                        post.get('slug').should.equal('test-title-' + num);
                        JSON.parse(post.get('mobiledoc')).cards[0][1].markdown.should.equal('Test Content ' + num);

                        Object.keys(eventsTriggered).length.should.eql(2);
                        should.exist(eventsTriggered['post.added']);
                        should.exist(eventsTriggered['user.attached']);
                        eventsTriggered['post.added'].length.should.eql(12);
                    });

                    done();
                }).catch(done);
            });

            it('can generate slugs without duplicate hyphens', function (done) {
                var newPost = {
                    title: 'apprehensive  titles  have  too  many  spaces—and m-dashes  —  –  and also n-dashes  ',
                    mobiledoc: markdownToMobiledoc('Test Content 1')
                };

                models.Post.add(newPost, context).then(function (createdPost) {
                    createdPost.get('slug').should.equal('apprehensive-titles-have-too-many-spaces-and-m-dashes-and-also-n-dashes');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                }).catch(done);
            });

            it('can generate a safe slug when a reserved keyword is used', function (done) {
                var newPost = {
                    title: 'rss',
                    mobiledoc: markdownToMobiledoc('Test Content 1')
                };

                models.Post.add(newPost, context).then(function (createdPost) {
                    createdPost.get('slug').should.not.equal('rss');

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['post.added']);
                    should.exist(eventsTriggered['user.attached']);

                    done();
                });
            });

            it('can generate slugs without non-ascii characters', function (done) {
                var newPost = {
                    title: 'भुते धडकी भरवणारा आहेत',
                    mobiledoc: markdownToMobiledoc('Test Content 1')
                };

                models.Post.add(newPost, context).then(function (createdPost) {
                    createdPost.get('slug').should.equal('bhute-dhddkii-bhrvnnaaraa-aahet');
                    done();
                }).catch(done);
            });

            it('detects duplicate slugs before saving', function (done) {
                var firstPost = {
                        title: 'First post',
                        mobiledoc: markdownToMobiledoc('First content 1')
                    },
                    secondPost = {
                        title: 'Second post',
                        mobiledoc: markdownToMobiledoc('Second content 1')
                    };

                // Create the first post
                models.Post.add(firstPost, context)
                    .then(function (createdFirstPost) {
                        // Store the slug for later
                        firstPost.slug = createdFirstPost.get('slug');

                        Object.keys(eventsTriggered).length.should.eql(2);
                        should.exist(eventsTriggered['post.added']);
                        should.exist(eventsTriggered['user.attached']);

                        // Create the second post
                        return models.Post.add(secondPost, context);
                    }).then(function (createdSecondPost) {
                    // Store the slug for comparison later
                        secondPost.slug = createdSecondPost.get('slug');

                        Object.keys(eventsTriggered).length.should.eql(2);
                        should.exist(eventsTriggered['post.added']);
                        should.exist(eventsTriggered['user.attached']);

                        // Update with a conflicting slug from the first post
                        return createdSecondPost.save({
                            slug: firstPost.slug
                        }, context);
                    }).then(function (updatedSecondPost) {
                    // Should have updated from original
                        updatedSecondPost.get('slug').should.not.equal(secondPost.slug);
                        // Should not have a conflicted slug from the first
                        updatedSecondPost.get('slug').should.not.equal(firstPost.slug);

                        Object.keys(eventsTriggered).length.should.eql(3);
                        should.exist(eventsTriggered['post.edited']);

                        return models.Post.findOne({
                            id: updatedSecondPost.id,
                            status: 'all'
                        });
                    }).then(function (foundPost) {
                    // Should have updated from original
                        foundPost.get('slug').should.not.equal(secondPost.slug);
                        // Should not have a conflicted slug from the first
                        foundPost.get('slug').should.not.equal(firstPost.slug);

                        done();
                    }).catch(done);
            });
        });

        describe('destroy', function () {
            afterEach(function () {
                return testUtils.truncate('posts_tags')
                    .then(function () {
                        return testUtils.truncate('tags');
                    })
                    .then(function () {
                        return testUtils.truncate('posts');
                    });
            });

            beforeEach(function () {
                testUtils.fixtures.insertPostsAndTags();
                eventsTriggered = {};
                sinon.stub(common.events, 'emit').callsFake(function (eventName, eventObj) {
                    if (!eventsTriggered[eventName]) {
                        eventsTriggered[eventName] = [];
                    }

                    eventsTriggered[eventName].push(eventObj);
                });
            });

            it('published post', function (done) {
                // We're going to try deleting post id 1 which has tag id 1
                var firstItemData = {id: testUtils.DataGenerator.Content.posts[0].id};

                // Test that we have the post we expect, with exactly one tag
                models.Post.findOne(firstItemData, {withRelated: ['tags']}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(firstItemData.id);
                    post.status.should.equal('published');
                    post.tags.should.have.length(2);
                    post.tags[0].id.should.equal(testUtils.DataGenerator.Content.tags[0].id);

                    // Destroy the post
                    return results.destroy();
                }).then(function (response) {
                    var deleted = response.toJSON();

                    should.equal(deleted.author, undefined);

                    Object.keys(eventsTriggered).length.should.eql(5);
                    should.exist(eventsTriggered['post.unpublished']);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['user.detached']);
                    should.exist(eventsTriggered['tag.detached']);
                    should.exist(eventsTriggered['post.tag.detached']);

                    // Double check we can't find the post again
                    return models.Post.findOne(firstItemData);
                }).then(function (newResults) {
                    should.equal(newResults, null);

                    // Double check we can't find any related tags
                    return ghostBookshelf.knex.select().table('posts_tags').where('post_id', firstItemData.id);
                }).then(function (postsTags) {
                    postsTags.should.be.empty();

                    done();
                }).catch(done);
            });

            it('draft post', function (done) {
                // We're going to try deleting post 4 which also has tag 4
                var firstItemData = {id: testUtils.DataGenerator.Content.posts[3].id, status: 'draft'};

                // Test that we have the post we expect, with exactly one tag
                models.Post.findOne(firstItemData, {withRelated: ['tags']}).then(function (results) {
                    var post;
                    should.exist(results);
                    post = results.toJSON();
                    post.id.should.equal(firstItemData.id);
                    post.tags.should.have.length(1);
                    post.tags[0].id.should.equal(testUtils.DataGenerator.Content.tags[3].id);

                    // Destroy the post
                    return results.destroy(firstItemData);
                }).then(function (response) {
                    var deleted = response.toJSON();

                    should.equal(deleted.author, undefined);

                    Object.keys(eventsTriggered).length.should.eql(4);
                    should.exist(eventsTriggered['post.deleted']);
                    should.exist(eventsTriggered['tag.detached']);
                    should.exist(eventsTriggered['post.tag.detached']);
                    should.exist(eventsTriggered['user.detached']);

                    // Double check we can't find the post again
                    return models.Post.findOne(firstItemData);
                }).then(function (newResults) {
                    should.equal(newResults, null);

                    // Double check we can't find any related tags
                    return ghostBookshelf.knex.select().table('posts_tags').where('post_id', firstItemData.id);
                }).then(function (postsTags) {
                    postsTags.should.be.empty();

                    done();
                }).catch(done);
            });

            it('published page', function (done) {
                // We're going to try deleting page 6 which has tag 1
                var firstItemData = {id: testUtils.DataGenerator.Content.posts[5].id};

                // Test that we have the post we expect, with exactly one tag
                models.Post.findOne(firstItemData, {withRelated: ['tags']}).then(function (results) {
                    var page;
                    should.exist(results);
                    page = results.toJSON();
                    page.id.should.equal(firstItemData.id);
                    page.status.should.equal('published');
                    page.page.should.be.true();

                    // Destroy the page
                    return results.destroy(firstItemData);
                }).then(function (response) {
                    var deleted = response.toJSON();

                    should.equal(deleted.author, undefined);

                    Object.keys(eventsTriggered).length.should.eql(3);
                    should.exist(eventsTriggered['page.unpublished']);
                    should.exist(eventsTriggered['page.deleted']);
                    should.exist(eventsTriggered['user.detached']);

                    // Double check we can't find the post again
                    return models.Post.findOne(firstItemData);
                }).then(function (newResults) {
                    should.equal(newResults, null);

                    // Double check we can't find any related tags
                    return ghostBookshelf.knex.select().table('posts_tags').where('post_id', firstItemData.id);
                }).then(function (postsTags) {
                    postsTags.should.be.empty();

                    done();
                }).catch(done);
            });

            it('draft page', function (done) {
                // We're going to try deleting post 7 which has tag 4
                var firstItemData = {id: testUtils.DataGenerator.Content.posts[6].id, status: 'draft'};

                // Test that we have the post we expect, with exactly one tag
                models.Post.findOne(firstItemData, {withRelated: ['tags']}).then(function (results) {
                    var page;
                    should.exist(results);
                    page = results.toJSON();
                    page.id.should.equal(firstItemData.id);

                    // Destroy the page
                    return results.destroy(firstItemData);
                }).then(function (response) {
                    var deleted = response.toJSON();

                    should.equal(deleted.author, undefined);

                    Object.keys(eventsTriggered).length.should.eql(2);
                    should.exist(eventsTriggered['page.deleted']);
                    should.exist(eventsTriggered['user.detached']);

                    // Double check we can't find the post again
                    return models.Post.findOne(firstItemData);
                }).then(function (newResults) {
                    should.equal(newResults, null);

                    // Double check we can't find any related tags
                    return ghostBookshelf.knex.select().table('posts_tags').where('post_id', firstItemData.id);
                }).then(function (postsTags) {
                    postsTags.should.be.empty();

                    done();
                }).catch(done);
            });
        });

        describe('Collision Protection', function () {
            before(testUtils.fixtures.insertPostsAndTags);

            after(function () {
                return testUtils.truncate('posts_tags')
                    .then(function () {
                        return testUtils.truncate('tags');
                    })
                    .then(function () {
                        return testUtils.truncate('posts');
                    });
            });

            it('update post title, but updated_at is out of sync', function () {
                var postToUpdate = {id: testUtils.DataGenerator.Content.posts[1].id};

                return models.Post.edit({
                    title: 'New Post Title',
                    updated_at: moment().subtract(1, 'day').format()
                }, _.extend({}, context, {id: postToUpdate.id}))
                    .then(function () {
                        throw new Error('expected no success');
                    })
                    .catch(function (err) {
                        err.code.should.eql('UPDATE_COLLISION');
                    });
            });

            it('update post tags and updated_at is out of sync', function () {
                var postToUpdate = {id: testUtils.DataGenerator.Content.posts[1].id};

                return models.Post.edit({
                    tags: [{name: 'new-tag-1'}],
                    updated_at: moment().subtract(1, 'day').format()
                }, _.extend({}, context, {id: postToUpdate.id}))
                    .then(function () {
                        throw new Error('expected no success');
                    })
                    .catch(function (err) {
                        err.code.should.eql('UPDATE_COLLISION');
                    });
            });

            it('update post authors and updated_at is out of sync', function () {
                var postToUpdate = {id: testUtils.DataGenerator.Content.posts[1].id};

                return models.Post.edit({
                    authors: [testUtils.DataGenerator.Content.users[3]],
                    updated_at: moment().subtract(1, 'day').format()
                }, _.extend({}, context, {id: postToUpdate.id}))
                    .then(function () {
                        throw new Error('expected no success');
                    })
                    .catch(function (err) {
                        err.code.should.eql('UPDATE_COLLISION');
                    });
            });

            it('update post tags and updated_at is NOT out of sync', function () {
                var postToUpdate = {id: testUtils.DataGenerator.Content.posts[1].id};

                return models.Post.edit({
                    tags: [{name: 'new-tag-1'}]
                }, _.extend({}, context, {id: postToUpdate.id}));
            });

            it('update post with no changes, but updated_at is out of sync', function () {
                var postToUpdate = {id: testUtils.DataGenerator.Content.posts[1].id};

                return models.Post.edit({
                    updated_at: moment().subtract(1, 'day').format()
                }, _.extend({}, context, {id: postToUpdate.id}));
            });

            it('update post with old post title, but updated_at is out of sync', function () {
                var postToUpdate = {
                    id: testUtils.DataGenerator.Content.posts[1].id,
                    title: testUtils.DataGenerator.forModel.posts[1].title
                };

                return models.Post.edit({
                    title: postToUpdate.title,
                    updated_at: moment().subtract(1, 'day').format()
                }, _.extend({}, context, {id: postToUpdate.id}));
            });
        });
    });

    describe('mobiledoc versioning', function () {
        it('can create revisions', function () {
            const newPost = {
                mobiledoc: markdownToMobiledoc('a')
            };

            return models.Post.add(newPost, context)
                .then((createdPost) => {
                    return models.Post.findOne({id: createdPost.id, status: 'all'});
                })
                .then((createdPost) => {
                    should.exist(createdPost);

                    return createdPost.save({mobiledoc: markdownToMobiledoc('b')}, context);
                })
                .then((updatedPost) => {
                    updatedPost.get('mobiledoc').should.equal(markdownToMobiledoc('b'));

                    return models.MobiledocRevision
                        .findAll({
                            filter: `post_id:${updatedPost.id}`
                        });
                })
                .then((mobiledocRevisions) => {
                    should.equal(mobiledocRevisions.length, 2);

                    mobiledocRevisions.toJSON()[0].mobiledoc.should.equal(markdownToMobiledoc('b'));
                    mobiledocRevisions.toJSON()[1].mobiledoc.should.equal(markdownToMobiledoc('a'));
                });
        });

        it('keeps only 10 last revisions in FIFO style', function () {
            let revisionedPost;
            const newPost = {
                mobiledoc: markdownToMobiledoc('revision: 0')
            };

            return models.Post.add(newPost, context)
                .then((createdPost) => {
                    return models.Post.findOne({id: createdPost.id, status: 'all'});
                })
                .then((createdPost) => {
                    should.exist(createdPost);
                    revisionedPost = createdPost;

                    return sequence(_.times(11, (i) => {
                        return () => {
                            return models.Post.edit({
                                mobiledoc: markdownToMobiledoc('revision: ' + (i + 1))
                            }, _.extend({}, context, {id: createdPost.id}));
                        };
                    }));
                })
                .then(() => models.MobiledocRevision
                    .findAll({
                        filter: `post_id:${revisionedPost.id}`
                    })
                )
                .then((mobiledocRevisions) => {
                    should.equal(mobiledocRevisions.length, 10);

                    mobiledocRevisions.toJSON()[0].mobiledoc.should.equal(markdownToMobiledoc('revision: 11'));
                    mobiledocRevisions.toJSON()[9].mobiledoc.should.equal(markdownToMobiledoc('revision: 2'));
                });
        });

        it('creates 2 revisions after first edit for previously unversioned post', function () {
            let unversionedPost;

            const newPost = {
                title: 'post title',
                mobiledoc: markdownToMobiledoc('a')
            };

            // passing 'migrating' flag to simulate unversioned post
            const options = Object.assign(_.clone(context), {migrating: true});

            return models.Post.add(newPost, options)
                .then((createdPost) => {
                    should.exist(createdPost);
                    unversionedPost = createdPost;
                    createdPost.get('mobiledoc').should.equal(markdownToMobiledoc('a'));

                    return models.MobiledocRevision
                        .findAll({
                            filter: `post_id:${createdPost.id}`
                        });
                })
                .then((mobiledocRevisions) => {
                    should.equal(mobiledocRevisions.length, 0);

                    return models.Post.edit({
                        mobiledoc: markdownToMobiledoc('b')
                    }, _.extend({}, context, {id: unversionedPost.id}));
                })
                .then((editedPost) => {
                    should.exist(editedPost);
                    editedPost.get('mobiledoc').should.equal(markdownToMobiledoc('b'));

                    return models.MobiledocRevision
                        .findAll({
                            filter: `post_id:${editedPost.id}`
                        });
                })
                .then((mobiledocRevisions) => {
                    should.equal(mobiledocRevisions.length, 2);

                    mobiledocRevisions.toJSON()[0].mobiledoc.should.equal(markdownToMobiledoc('b'));
                    mobiledocRevisions.toJSON()[1].mobiledoc.should.equal(markdownToMobiledoc('a'));
                });
        });
    });

    describe('Multiauthor Posts', function () {
        after(function () {
            return testUtils.teardown()
                .then(function () {
                    return testUtils.setup('users:roles')();
                });
        });

        before(function () {
            testUtils.teardown();
            testUtils.setup('posts:mu');
        });

        it('can destroy multiple posts by author', function (done) {
            // We're going to delete all posts by user 1
            var authorData = {id: testUtils.DataGenerator.Content.users[0].id};

            models.Post.findAll({context: {internal: true}}).then(function (found) {
                // There are 25 posts created by posts:mu fixture
                found.length.should.equal(25);
                return models.Post.destroyByAuthor(authorData);
            }).then(function (results) {
                // User 1 has 5 posts in the database (each user has proportionate amount)
                // 5 = 25 / 5 (posts / users)
                results.length.should.equal(5);
                return models.Post.findAll({context: {internal: true}});
            }).then(function (found) {
                // Only 20 should remain
                // 20 = 25 - 5
                found.length.should.equal(20);
                done();
            }).catch(done);
        });
    });

    describe('Post tag handling edge cases', function () {
        var postJSON,
            tagJSON,
            editOptions,
            createTag = testUtils.DataGenerator.forKnex.createTag;
        beforeEach(function () {
            testUtils.truncate('posts_tags')
                .then(function () {
                    return testUtils.truncate('tags');
                })
                .then(function () {
                    return testUtils.truncate('posts');
                });
            tagJSON = [];

            var post = _.cloneDeep(testUtils.DataGenerator.forModel.posts[0]),
                postTags = [
                    createTag({name: 'tag1', slug: 'tag1'}),
                    createTag({name: 'tag2', slug: 'tag2'}),
                    createTag({name: 'tag3', slug: 'tag3'})
                ],
                extraTags = [
                    createTag({name: 'existing tag a', slug: 'existing-tag-a'}),
                    createTag({name: 'existing-tag-b', slug: 'existing-tag-b'}),
                    createTag({name: 'existing_tag_c', slug: 'existing_tag_c'})
                ];

            post.tags = postTags;
            post.status = 'published';

            return Promise.props({
                post: models.Post.add(post, _.extend({}, context, {withRelated: ['tags']})),
                tag1: models.Tag.add(extraTags[0], context),
                tag2: models.Tag.add(extraTags[1], context),
                tag3: models.Tag.add(extraTags[2], context)
            }).then(function (result) {
                postJSON = result.post.toJSON({withRelated: ['tags']});
                tagJSON.push(result.tag1.toJSON());
                tagJSON.push(result.tag2.toJSON());
                tagJSON.push(result.tag3.toJSON());
                editOptions = _.extend({}, context, {id: postJSON.id, withRelated: ['tags']});

                // reset the eventSpy here
                sinon.restore();
            });
        });

        it('should create the test data correctly', function (done) {
            // creates a test tag
            should.exist(tagJSON);
            tagJSON.should.be.an.Array().with.lengthOf(3);

            tagJSON[0].name.should.eql('existing tag a');
            tagJSON[1].name.should.eql('existing-tag-b');
            tagJSON[2].name.should.eql('existing_tag_c');

            // creates a test post with an array of tags in the correct order
            should.exist(postJSON);
            postJSON.title.should.eql('HTML Ipsum');
            should.exist(postJSON.tags);
            postJSON.tags.should.be.an.Array().and.have.lengthOf(3);

            postJSON.tags[0].name.should.eql('tag1');
            postJSON.tags[1].name.should.eql('tag2');
            postJSON.tags[2].name.should.eql('tag3');

            done();
        });

        it('can edit slug of existing tag', function () {
            var newJSON = _.cloneDeep(postJSON);

            // Add an existing tag to the beginning of the array
            newJSON.tags = [{id: postJSON.tags[0].id, slug: 'eins'}];

            // Edit the post
            return models.Post.edit(newJSON, editOptions).then(function (updatedPost) {
                updatedPost = updatedPost.toJSON({withRelated: ['tags']});

                updatedPost.tags.should.have.lengthOf(1);
                updatedPost.tags[0].name.should.eql(postJSON.tags[0].name);
                updatedPost.tags[0].slug.should.eql('eins');
                updatedPost.tags[0].id.should.eql(postJSON.tags[0].id);
            });
        });

        it('can\'t edit dates and authors of existing tag', function () {
            var newJSON = _.cloneDeep(postJSON), updatedAtFormat, createdAtFormat;

            // Add an existing tag to the beginning of the array
            newJSON.tags = [_.cloneDeep(postJSON.tags[0])];
            newJSON.tags[0].created_at = moment().add(2, 'days').format('YYYY-MM-DD HH:mm:ss');
            newJSON.tags[0].updated_at = moment().add(2, 'days').format('YYYY-MM-DD HH:mm:ss');

            // NOTE: this is currently only removed in the API layer
            newJSON.tags[0].parent_id = newJSON.tags[0].parent;
            delete newJSON.tags[0].parent;

            // Edit the post
            return Promise.delay(1000)
                .then(function () {
                    return models.Post.edit(newJSON, editOptions);
                })
                .then(function (updatedPost) {
                    updatedPost = updatedPost.toJSON({withRelated: ['tags']});

                    updatedPost.tags.should.have.lengthOf(1);
                    updatedPost.tags[0].should.have.properties({
                        name: postJSON.tags[0].name,
                        slug: postJSON.tags[0].slug,
                        id: postJSON.tags[0].id,
                        created_by: postJSON.tags[0].created_by,
                        updated_by: postJSON.tags[0].updated_by
                    });

                    updatedAtFormat = moment(updatedPost.tags[0].updated_at).format('YYYY-MM-DD HH:mm:ss');
                    updatedAtFormat.should.eql(moment(postJSON.tags[0].updated_at).format('YYYY-MM-DD HH:mm:ss'));
                    updatedAtFormat.should.not.eql(moment(newJSON.tags[0].updated_at).format('YYYY-MM-DD HH:mm:ss'));

                    createdAtFormat = moment(updatedPost.tags[0].created_at).format('YYYY-MM-DD HH:mm:ss');
                    createdAtFormat.should.eql(moment(postJSON.tags[0].created_at).format('YYYY-MM-DD HH:mm:ss'));
                    createdAtFormat.should.not.eql(moment(newJSON.tags[0].created_at).format('YYYY-MM-DD HH:mm:ss'));
                });
        });

        it('can reorder existing, added and deleted tags', function () {
            var newJSON = _.cloneDeep(postJSON),
                lastTag = [postJSON.tags[2]];

            // remove tag in the middle (tag1, tag2, tag3 -> tag1, tag3)
            newJSON.tags.splice(1, 1);

            // add a new one as first tag and reorder existing (tag4, tag3, tag1)
            newJSON.tags = [{name: 'tag4'}].concat([newJSON.tags[1]]).concat([newJSON.tags[0]]);

            // Edit the post
            return models.Post.edit(newJSON, editOptions).then(function (updatedPost) {
                updatedPost = updatedPost.toJSON({withRelated: ['tags']});

                updatedPost.tags.should.have.lengthOf(3);
                updatedPost.tags[0].should.have.properties({
                    name: 'tag4'
                });

                updatedPost.tags[1].should.have.properties({
                    name: 'tag3',
                    id: postJSON.tags[2].id
                });

                updatedPost.tags[2].should.have.properties({
                    name: 'tag1',
                    id: postJSON.tags[0].id
                });
            });
        });

        it('can add multiple tags with conflicting slugs', function () {
            var newJSON = _.cloneDeep(postJSON);

            // Add conflicting tags to the end of the array
            newJSON.tags = [];
            newJSON.tags.push({name: 'C'});
            newJSON.tags.push({name: 'C++'});
            newJSON.tags.push({name: 'C#'});

            // Edit the post
            return models.Post.edit(newJSON, editOptions).then(function (updatedPost) {
                updatedPost = updatedPost.toJSON({withRelated: ['tags']});

                updatedPost.tags.should.have.lengthOf(3);

                updatedPost.tags[0].should.have.properties({name: 'C', slug: 'c'});
                updatedPost.tags[1].should.have.properties({name: 'C++', slug: 'c-2'});
                updatedPost.tags[2].should.have.properties({name: 'C#', slug: 'c-3'});
            });
        });

        it('can handle lowercase/uppercase tags', function () {
            var newJSON = _.cloneDeep(postJSON);

            // Add conflicting tags to the end of the array
            newJSON.tags = [];
            newJSON.tags.push({name: 'test'});
            newJSON.tags.push({name: 'tEst'});

            // Edit the post
            return models.Post.edit(newJSON, editOptions).then(function (updatedPost) {
                updatedPost = updatedPost.toJSON({withRelated: ['tags']});

                updatedPost.tags.should.have.lengthOf(1);
            });
        });
    });

    // disabling sanitization until we can implement a better version
    // it('should sanitize the title', function (done) {
    //    new models.Post().fetch().then(function (model) {
    //        return model.set({'title': "</title></head><body><script>alert('blogtitle');</script>"}).save();
    //    }).then(function (saved) {
    //        saved.get('title').should.eql("&lt;/title&gt;&lt;/head>&lt;body&gt;[removed]alert&#40;'blogtitle'&#41;;[removed]");
    //        done();
    //    }).catch(done);
    // });
});
