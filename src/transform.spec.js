const jp = require('jsonpath');
const F = require('functional-pipelines');
const traverse = require('traverse');

const {transform} = require('./transform');

const original = Object.freeze({
    id: 123,
    title: 'Bicycle 123',
    description: 'Bicycle 123 is a fabulous item that you have to spend all your money on',
    updatedAt: '2017-10-13T10:37:47',
    bicycleType: 'Hybrid',
    brand: 'Brand-Company C',
    price: 500,
    color: ['Red', 'Black', 'White'],
    productCategory: 'Bicycle',
    inStok: true,
    inStockCount: '100',
    quantityOnHand: null,
    relatedItems: [341, 472, 649],
    tags: {
        hot: {author: 'anonymousUser1', timestamp: '2016MMDDHHmmssSSS'},
        seasonal: {author: 'anonymousUser2', timestamp: '2017MMDDHHmmssSSS'},
        personalTransportation: {author: 'memberUser3', timestamp: '2015MMDDHHmmssSSS'},
        'tag-name-with-dash': {author: 'memberUser4', timestamp: '2015MMDDHHmmssSSS'},
        'tag name with spaces': {author: 'memberUser5', timestamp: '2015MMDDHHmmssSSS'},
        'tag.name.with.dots': {author: 'memberUser6', timestamp: '2015MMDDHHmmssSSS'},
    },
    pictures: [
        {
            view: 'front',
            images: [{big: 'http://example.com/products/123_front.jpg'}, {thumbnail: 'http://example.com/products/123_front_small.jpg'}]
        },
        {
            view: 'rear',
            images: [{big: 'http://example.com/products/123_rear.jpg'}, {thumbnail: 'http://example.com/products/123_rear_small.jpg'}]
        },
        {
            view: 'side',
            images: [{big: 'http://example.com/products/123_left_side.jpg'}, {thumbnail: 'http://example.com/products/123_left_side_small.jpg'}]
        }
    ],
    productReview: {
        fiveStar: [
            {
                author: 'user1@domain1.com',
                'first.name': 'user1',
                comment: "Excellent! Can't recommend it highly enough! Buy it!",
                score: 5,
                viewAs: '*****'
            },
            {
                author: 'user2@domain2.com',
                'first.name': 'user2',
                comment: 'Do yourself a favor and buy this.',
                score: 5,
                viewAs: '*****'
            }
        ],
        oneStar: [
            {
                author: 'user3@domain3.com',
                'first.name': 'user3',
                comment: 'Terrible product! Do no buy this.',
                score: 1,
                viewAs: '*----'
            }
        ]
    },
    comment: '/HOME/This product sells out quickly during the summer',
    'Safety.Warning.On.Root': 'Always wear a helmet' // attribute name with `.`
});

describe('transform/meta-0 (jsonpath deref and string template interpolation)', () => {
    const template = {
        name: '{{title}} [{{description}}] http://items/{{title}}',
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: '{{productReview.fiveStar[0].comment}}',
            low: '{{productReview.oneStar[0].comment}}',
            disclaimer: 'Ad: {{comment}}',
            version: 10,
            details: null,
            active: true
        },
        safety: '{{["Safety.Warning.On.Root"]}}',
        topRaters: ['{{productReview.fiveStar[0]["first.name"]}}', '{{productReview.fiveStar[1]["first.name"]}}', '{{productReview.oneStar[0]["first.name"]}}', 10, null, true],
        topTaggers: '{{tags["tag-name-with-dash"].author}} - {{tags["tag name with spaces"].author}} - {{tags["tag.name.with.dots"].author}}',
        oneScore: '{{productReview..score}}', // <- * means get exactly one search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        users: '{{..author}}',
        version: 10,
        details: null,
        active: true
    };

    const expectedResult = {
        name: `${original.title} [${original.description}] http://items/${original.title}`,
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: original.productReview.fiveStar[0].comment,
            low: original.productReview.oneStar[0].comment,
            disclaimer: `Ad: ${original.comment}`,
            version: 10,
            details: null,
            active: true
        },
        safety: original['Safety.Warning.On.Root'],
        topRaters: ["user1", "user2", "user3", 10, null, true], // array in template didn't have special semantics
        topTaggers: 'memberUser4 - memberUser5 - memberUser6',
        oneScore: 1,
        users: 'user3@domain3.com',
        version: 10,
        details: null,
        active: true
    };

    let result;
    const templateClone = traverse(template).clone();
    const documentClone = traverse(original).clone();

    beforeEach(() => {
        result = transform(templateClone)(documentClone);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });

    it('does not mutate the source', () => {
        expect(documentClone).toEqual(original);
    });

    it('handles 1..* levels of nesting, and special characters in attribute names', () => {
        expect(result).toEqual(expectedResult);
    });
});

describe('deref-jsonpath:: meta-0/1/2 simple interpolation with query modifiers with [ NO ] arguments + constrains', () => {
    const template = {
        name: '{{title}} [{{description}}] http://items/{{title}}',
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: '{{productReview.fiveStar[0].comment}}',
            low: '{{productReview.oneStar[0].comment}}',
            disclaimer: 'Ad: {{comment}}'
        },
        safety: '{{["Safety.Warning.On.Root"]}}',
        topRaters: '{{productReview.fiveStar[0]["first.name"]}} - {{productReview.fiveStar[1]["first.name"]}} - {{productReview.oneStar[0]["first.name"]}}',
        topTaggers: '{{tags["tag-name-with-dash"].author}} - {{tags["tag name with spaces"].author}} - {{tags["tag.name.with.dots"].author}}',
        scores: '{+{productReview..score}}', // <- * means get one or more search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        oneScore: '{{productReview..score}}', // <- * means get exactly one search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        users: '{+{..author}}', // take all matches
        optional: '{?{["not.there"]}}', // key would vanish if value doesn't exist
        optionalInContext: 'Value for not.there = {?{["not.there"]}}', // would evaluate to '' if value doesn't exist
        required: '{!{["not.there"]}}' // should be set to null if value doesn't exist
    };

    const expectedResult = {
        name: `${original.title} [${original.description}] http://items/${original.title}`,
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: original.productReview.fiveStar[0].comment,
            low: original.productReview.oneStar[0].comment,
            disclaimer: `Ad: ${original.comment}`
        },
        safety: original['Safety.Warning.On.Root'],
        topRaters: 'user1 - user2 - user3',
        topTaggers: "memberUser4 - memberUser5 - memberUser6",
        scores: [5, 5, 1],
        oneScore: 1,
        users: ["anonymousUser1", "anonymousUser2", "memberUser3", "memberUser4", "memberUser5", "memberUser6", "user1@domain1.com", "user2@domain2.com", "user3@domain3.com"],
        optionalInContext: 'Value for not.there = ',
        required: null
    };

    let result;
    const templateClone = traverse(template).clone();
    const documentClone = traverse(original).clone();

    beforeEach(() => {
        result = transform(templateClone)(documentClone);
    });

    it('handles 1..* levels of nesting, and special characters in attribute names', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });

    it('does not mutate the source', () => {
        expect(documentClone).toEqual(original);
    });
});

describe('deref-jsonpath:: meta-0/1/2 simple interpolation with query modifiers [+] with arguments + constrains [!?] with arguments', () => {
    const template = {
        name: '{{title}} [{{description}}] http://items/{{title}}',
        // updatedAt: '{!asDate{updatedAt}}', // support removed from syntax
        // inStockCount: '{!asInt{inStockCount}}', // support removed from syntax
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: '{{productReview.fiveStar[0].comment}}',
            low: '{{productReview.oneStar[0].comment}}',
            disclaimer: 'Ad: {{comment}}'
        },
        safety: '{{["Safety.Warning.On.Root"]}}',
        topRaters: '{{productReview.fiveStar[0]["first.name"]}} - {{productReview.fiveStar[1]["first.name"]}} - {{productReview.oneStar[0]["first.name"]}}',
        topTaggers: '{{tags["tag-name-with-dash"].author}} - {{tags["tag name with spaces"].author}} - {{tags["tag.name.with.dots"].author}}',
        scores: '{+2{productReview..score}}', // <- * means get one or more search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        oneScore: '{{productReview..score}}', // <- * means get exactly one search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        users: '{+100{..author}}', // take all matches
        top5users: '{+5{..author}}', // take n matches
        optional1: '{?=default {["not.there"]}}', // lookup from sources['default']
        optional2: '{?=default:OPTIONAL DEFAULT VALUE 2 {["not.there"]}}', // use default value provided
        optional2Quoted: '{?=default:"OPTIONAL DEFAULT VALUE 2" {["not.there"]}}', // use default value provided
        optional3: '{?=default:optional-default-value-3 {["not.there"]}}', // use default value provided
        optionalInContext1: 'Value for not.there = {?=default: {["not.there"]}}', // use default value provided ''
        optionalInContext2: 'Value for not.there = {?=default:"" {["not.there"]}}', // use default value provided ''
        optionalInContext3: 'Value for not.there = {?=default:default value {["not.there"]}}', // use default value provided ''
        optionalInContext3Quoted: 'Value for not.there = {?=default:"default value in quotes" {["not.there"]}}', // use default value provided ''
        required: '{!{["not.there"]}}', // should be set to null
        required1: '{!={["not.there"]}}', // should be set to null
        required2: '{!=altSource1{["not.there"]}}', // lookup value in alt-source, else null
        required3: '{!=altSource1{["not.there.in.alt.source"]}}', // lookup value in alt-source, else null
        required4: '{!=altSource1:ALT_VALUE_DEFAULT{["not.there.in.alt.source"]}}', // lookup value in alt-source, else default
        required5: '{!=altSourceMissing{["not.there"]}}', // should be set to null
        required6: '{!=altSourceMissing{["not.there.for.sure"]}}', // should be set to null
        required7: '{!=altSourceMissing:ALT_VALUE_DEFAULT{["not.there.for.sure"]}}' // should be set to default
    };

    const expectedResult = {
        name: `${original.title} [${original.description}] http://items/${original.title}`,
        // updatedAt: new Date(original.updatedAt),
        // inStockCount: parseInt(original.inStockCount, 10),
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: original.productReview.fiveStar[0].comment,
            low: original.productReview.oneStar[0].comment,
            disclaimer: `Ad: ${original.comment}`
        },
        safety: original['Safety.Warning.On.Root'],
        topRaters: 'user1 - user2 - user3',
        topTaggers: "memberUser4 - memberUser5 - memberUser6",
        scores: [5, 5],
        oneScore: 1,
        users: ["anonymousUser1", "anonymousUser2", "memberUser3", "memberUser4", "memberUser5", "memberUser6", "user1@domain1.com", "user2@domain2.com", "user3@domain3.com"],
        top5users: ["anonymousUser1", "anonymousUser2", "memberUser3", "memberUser4", "memberUser5"],
        optional1: "@default::default-value", // lookup from sources['default']
        optional2: "OPTIONAL DEFAULT VALUE 2", // use default value provided
        optional2Quoted: '"OPTIONAL DEFAULT VALUE 2"', // use default value provided
        optional3: "optional-default-value-3", // use default value provided
        optionalInContext1: 'Value for not.there = ',
        optionalInContext2: 'Value for not.there = ""',
        optionalInContext3: 'Value for not.there = default value',
        optionalInContext3Quoted: 'Value for not.there = "default value in quotes"',
        required: null, // should be set to null
        required1: null, // should be set to null
        required2: '@alt-source::alt-value', // lookup value in alt-source, else null
        required3: null, // lookup value in alt-source, else null
        required4: 'ALT_VALUE_DEFAULT', // lookup value in alt-source, else default
        required5: null, // should be set to null
        required6: null, // should be set to null
        required7: 'ALT_VALUE_DEFAULT' // should be set to default
    };

    let result;
    const templateClone = traverse(template).clone();
    const documentClone = traverse(original).clone();

    beforeEach(() => {
        result = transform(templateClone, {
            sources: {
                'default': {'not.there': '@default::default-value'},
                altSource1: {'not.there': '@alt-source::alt-value'}
            }
        })(documentClone);
    });

    it('handles 1..* levels of nesting, and special characters in attribute names', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });

    it('does not mutate the source', () => {
        expect(documentClone).toEqual(original);
    });
});

describe('deref-jsonpath:: meta-0/1/2 simple interpolation with query modifiers [+] with arguments + constrains [!?] with arguments | functions pipeline', () => {
    const template = {
        name: '{{title} | toUpperCase } [{{description}}] http://items/{{title}}',
        // updatedAt: '{!asDate{updatedAt}}',
        // inStockCount: '{!asInt{inStockCount}}',
        reviews: {
            eula: 'read and agree and let us get on with it',
            high: '{{productReview.fiveStar[0].comment}}',
            low: '{{productReview.oneStar[0].comment}}',
            disclaimer: 'Ad: {{comment}}'
        },
        expensive: '{{price} | gte:500:__}',
        safety: '{{["Safety.Warning.On.Root"]} | ellipsis:15 }',
        topRaters: '{{productReview.fiveStar[0]["first.name"]}} - {{productReview.fiveStar[1]["first.name"]}} - {{productReview.oneStar[0]["first.name"]}}',
        topTaggers: '{{tags["tag-name-with-dash"].author}} - {{tags["tag name with spaces"].author}} - {{tags["tag.name.with.dots"].author}}',
        scores: '{+2{productReview..score}}', // <- * means get one or more search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        oneScore: '{{productReview..score}}', // <- * means get exactly one search results. The value is substituted as is unless the place holder is a part of a bigger string, in that case it is replaced into the string template
        users: '{+100{..author} | take:2 }', // take all matches
        top5users: '{+5{..author}}', // take n matches
        optional1: '{?=default {["not.there"]}}', // lookup from sources['default']
        optional2: '{?=default:OPTIONAL DEFAULT VALUE 2 {["not.there"]}}', // use default value provided
        optional2Quoted: '{?=default:"OPTIONAL DEFAULT VALUE 2" {["not.there"]}}', // use default value provided
        optional3: '{?=default:optional-default-value-3 {["not.there"]}}', // use default value provided
        optionalInContext1: 'Value for not.there = {?=default: {["not.there"]}}', // use default value provided ''
        optionalInContext2: 'Value for not.there = {?=default:"" {["not.there"]}}', // use default value provided ''
        optionalInContext3: 'Value for not.there = {?=default:default value {["not.there"]}}', // use default value provided ''
        optionalInContext3Quoted: 'Value for not.there = {?=default:"default value in quotes" {["not.there"]}}', // use default value provided ''
        required: '{!{["not.there"]}}', // should be set to null
        required1: '{!={["not.there"]}}', // should be set to null
        required2: '{!=altSource1{["not.there"]}}', // lookup value in alt-source, else null
        required3: '{!=altSource1{["not.there.in.alt.source"]}}', // lookup value in alt-source, else null
        required4: '{!=altSource1:ALT_VALUE_DEFAULT{["not.there.in.alt.source"]}}', // lookup value in alt-source, else default
        required5: '{!=altSourceMissing{["not.there"]}}', // should be set to null
        required6: '{!=altSourceMissing{["not.there.for.sure"]}}', // should be set to null
        required7: '{!=altSourceMissing:ALT_VALUE_DEFAULT{["not.there.for.sure"]}}' // should be set to default
    };

    const expectedResult = {
            name: `${original.title.toUpperCase()} [${original.description}] http://items/${original.title}`,
            // updatedAt: new Date(original.updatedAt),
            // inStockCount: parseInt(original.inStockCount, 10),
            reviews:
                {
                    eula: 'read and agree and let us get on with it',
                    high:
                    original.productReview.fiveStar[0].comment,
                    low:
                    original.productReview.oneStar[0].comment,
                    disclaimer:
                        `Ad: ${original.comment}`
                }
            ,
            expensive: true,
            safety: "Always wear ...",
            topRaters:
                'user1 - user2 - user3',
            topTaggers:
                "memberUser4 - memberUser5 - memberUser6",
            scores:
                [5, 5],
            oneScore:
                1,
            users:
                ["anonymousUser1", "anonymousUser2"],
            top5users:
                ["anonymousUser1", "anonymousUser2", "memberUser3", "memberUser4", "memberUser5"],
            optional1:
                "@default::default-value", // lookup from sources['default']
            optional2:
                "OPTIONAL DEFAULT VALUE 2", // use default value provided
            optional2Quoted:
                '"OPTIONAL DEFAULT VALUE 2"', // use default value provided
            optional3:
                "optional-default-value-3", // use default value provided
            optionalInContext1:
                'Value for not.there = ',
            optionalInContext2:
                'Value for not.there = ""',
            optionalInContext3:
                'Value for not.there = default value',
            optionalInContext3Quoted:
                'Value for not.there = "default value in quotes"',
            required:
                null, // should be set to null
            required1:
                null, // should be set to null
            required2:
                '@alt-source::alt-value', // lookup value in alt-source, else null
            required3:
                null, // lookup value in alt-source, else null
            required4:
                'ALT_VALUE_DEFAULT', // lookup value in alt-source, else default
            required5:
                null, // should be set to null
            required6:
                null, // should be set to null
            required7:
                'ALT_VALUE_DEFAULT' // should be set to default
        }
    ;

    let result;
    const templateClone = traverse(template).clone();
    const documentClone = traverse(original).clone();

    beforeEach(() => {
        result = transform(templateClone, {
            sources: {
                'default': {'not.there': '@default::default-value'},
                altSource1: {'not.there': '@alt-source::alt-value'}
            }
        })(documentClone);
    });

    it('handles 1..* levels of nesting, and special characters in attribute names', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });

    it('does not mutate the source', () => {
        expect(documentClone).toEqual(original);
    });
});

describe.skip('deref-jsonpath:: meta-0/1/2/3 inception, apply first element as `document` to n successor array elements as template', () => {
    const template = {
        name: '{{title}}',
        reviews: {
            high: [1, 2, 'prelude', ['a', 'b', 'c'], '{{productReview.fiveStar.length}}', {keyBefore: 'literal value before'},
                '{.. {productReview.fiveStar}}',
                {
                    praise: '{+{["comment","author"]}}',
                    stars: '{{viewAs}}'
                },
                {keyAfter: 'literal value after'},
                '{{description}}'
            ],
            low: ['{.. {productReview.oneStar}}', {
                criticism: '{{[(@.length - 1)].comment}}'
            }],
            disclaimer: 'Ad: {{comment}}'
        },
        reviewsSummary: ['{..|**{productReview}}', '{{$}}'], // [keys]
        views: ['{.. | ** {pictures}}', '[{{view}}]({{images.length}})'],
        profiles: ['{.. | ** | + {..author}}', 'www.domain.com/user/?name={{$}}']
    };

    const expectedResult = {
        name: original.title,
        reviews: {
            high: [1, 2, 'prelude', {keyBefore: 'literal value before'}, ['a', 'b', 'c'], original.productReview.fiveStar.length,
                original.productReview.fiveStar.map(x => ({praise: [x.comment, x.author], stars: x.viewAs})),
                {keyAfter: 'literal value after'}],
            low: [{criticism: original.productReview.oneStar[original.productReview.oneStar.length - 1].comment}],
            disclaimer: `Ad: ${original.comment}`
        },
        reviewsSummary: F.map(([k, v]) => k, F.iterator(original.productReview, {indexed: true, kv: true})),
        views: [original.pictures.map(x => `[${x.view}](${x.images.length})`)],
        profiles: [jp.query(original, '$..author').map(x => `www.domain.com/user/?name=${x}`)]
    };

    let result;
    const templateClone = traverse(template).clone();

    beforeEach(() => {
        result = transform(templateClone)(original);
    });

    it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });
});

describe('deref-jsonpath:: meta-0/1/2/3 inception, apply first element as `document` to n successor array elements as template', () => {
    const template = {
        name: '{{title}}',
        reviews: {
            high: [1, 2, 'prelude', {keyBefore: 'literal value before'}, ['a', 'b', 'c'], '{{productReview.fiveStar.length}}', '{>> {productReview.fiveStar[0]}}', {
                praise: '{+{["author","comment"]}}',
                stars: '{{viewAs}}'
            }, {keyAfter: 'literal value after'}
            ],
            low: ['{>* {productReview.oneStar}}',
                {
                    criticism: '{{[(@.length - 1)].comment}}'
                },
                {count: '{{length}}'}
            ],
            disclaimer: 'Ad: {{comment}}'
        },
        reviewsSummary: [
            '{>>>{productReview}}', //use this after rendering as a scoped-document, render next n templates with it
            '{+{$..score}}',
            {summary: {fiveStar: '{{fiveStar.length}}', oneStar: '{{oneStar.length}}'}}
        ], // render next n nodes with leading rendered item as scoped-document
        views: ['{%% {pictures}}', '[{{view}}]({{images.length}})'], // for-each item in enumerable scoped-document, render with next node
        twoimages: ['{+ %2 {pictures..images}}', 'front -> {{[1].thumbnail}}', 'rear -> {{[1].thumbnail}}', 'side -> {?=default:Not Available{[1].thumbnail}}'], // zip-align
        images: ['{+ %* {pictures..images}}', 'front -> {{[1].thumbnail}}', 'rear -> {{[1].thumbnail}}', 'side -> {{[1].thumbnail}}'] // zip-align
    };

    const expectedResult = {
        "name": "Bicycle 123",
        "reviews": {
            "high": [1, 2, "prelude", {"keyBefore": "literal value before"}, ["a", "b", "c"], 2, {
                "praise": ["user1@domain1.com", "Excellent! Can't recommend it highly enough! Buy it!"],
                "stars": "*****"
            }, {"keyAfter": "literal value after"}],
            "low": [{"criticism": "Terrible product! Do no buy this."}, {"count": 1}],
            "disclaimer": "Ad: /HOME/This product sells out quickly during the summer"
        },
        "reviewsSummary": [[5, 5, 1], {"summary": {"fiveStar": 2, "oneStar": 1}}],
        "views": ["[front](2)", "[rear](2)", "[side](2)"],
        "twoimages": ["front -> http://example.com/products/123_front_small.jpg", "rear -> http://example.com/products/123_rear_small.jpg", "side -> Not Available"],
        "images": ["front -> http://example.com/products/123_front_small.jpg", "rear -> http://example.com/products/123_rear_small.jpg", "side -> http://example.com/products/123_left_side_small.jpg"]
    };

    let result;
    const templateClone = traverse(template).clone();

    beforeEach(() => {
        result = transform(templateClone)(original);
    });

    it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });
});

describe('deref-jsonpath:: meta-0/1/2/3 flatten and doubleFlatten pipes`} | * | ** }`', () => {
    const template = {
        allReviews: '{+{..productReview["fiveStar","oneStar"]}|*}',
        fiveStar: '{+{..fiveStar}|*}' // example common use-case: multiple results for jsonpath.query are in an array, fiveStar item is also an array
    };

    const expectedResult = {
            "allReviews": [{
                "author": "user1@domain1.com",
                "comment": "Excellent! Can't recommend it highly enough! Buy it!",
                "first.name": "user1",
                "score": 5,
                "viewAs": "*****"
            }, {
                "author": "user2@domain2.com",
                "comment": "Do yourself a favor and buy this.",
                "first.name": "user2",
                "score": 5,
                "viewAs": "*****"
            }, {
                "author": "user3@domain3.com",
                "comment": "Terrible product! Do no buy this.",
                "first.name": "user3",
                "score": 1,
                "viewAs": "*----"
            }],
            "fiveStar": [{
                "author": "user1@domain1.com",
                "comment": "Excellent! Can't recommend it highly enough! Buy it!",
                "first.name": "user1",
                "score": 5,
                "viewAs": "*****"
            }, {
                "author": "user2@domain2.com",
                "comment": "Do yourself a favor and buy this.",
                "first.name": "user2",
                "score": 5,
                "viewAs": "*****"
            }]
        };

    let result;
    const templateClone = traverse(template).clone();

    beforeEach(() => {
        result = transform(templateClone)(original);
    });

    it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
        expect(result).toEqual(expectedResult);
    });

    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });
});

describe('deref-jsonpath:: meta-0/1/2/3 tagging and casting using tagHandlers`', () => {
    const template = {
        a: {
            b: {
                c: '{#{title}}', // select this node's path, update value into tags under $.a.b.c
                d: '{#id{id}}'
            }
        }
    };

    const expectedResult =  {"a": {"b": {"c": "Bicycle 123", "d": 123}}};

    let result;
    const templateClone = traverse(template).clone();
    let tags = {};

    beforeEach(() => {
        result = transform(templateClone, {tags})(original);
    });

    it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
        expect(result).toEqual(expectedResult);
    });

    it('sets the tagged values into tags either by label or path', () => {
        expect(tags).toEqual({id: original.id, a: {b: {c: original.title}}}); //tag with no name uses the tagged node's path
    });


    it('does not mutate the template', () => {
        expect(templateClone).toEqual(template);
    });
});