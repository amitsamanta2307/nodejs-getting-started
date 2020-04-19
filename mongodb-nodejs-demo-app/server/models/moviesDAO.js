'use strict';

const { ObjectId } = require('mongodb');
const appSettings = require('../config/app-settings');

let mflix;
let movies;
const DEFAULT_SORT = [["tomatoes.viewer.numReviews", -1]];

class MoviesDAO {

    static async injectDB(conn) {
        if (movies) {
            return;
        }

        try {
            mflix = await conn.db(appSettings.DATABASE);
            movies = await conn.db(appSettings.DATABASE).collection("movies");

            // this is only for testing
            this.movies = movies;
        } catch (e) {
            console.error(`Unable to establish a collection handle in moviesDAO: ${e}`)
        }
    }

    /**
     * Finds and returns movies by country.
     * Returns a list of objects, each object contains a title and an _id.
     * @param {Object} filters - The search parameters to use in the query.
     * @param {number} page - The page of movies to retrieve.
     * @param {number} moviesPerPage - The number of movies to display per page.
     * @returns {GetMoviesResult} An object with movie results and total results
     * that would match this query
     */
    static async getMovies({ filters = null, page = 0, moviesPerPage = 20 } = {}) {

        let queryParams = {};

        if (filters) {
            if ('text' in filters) {
                queryParams = this.textSearchQuery(filters['text']);
            } else if ('cast' in filters) {
                queryParams = this.castSearchQuery(filters['cast']);
            } else if ('genre' in filters) {
                queryParams = this.genreSearchQuery(filters['genre']);
            }
        }

        let { query = {}, project = {}, sort = DEFAULT_SORT } = queryParams;
        let cursor;

        try {
            cursor = await movies.find(query).project(project).sort(sort);
        } catch (e) {
            console.log(`Unable to issue find command, ${e}`)
            return { moviesList: [], totalNumMovies: 0 };
        }

        // Ticket: Paging
        const MOVIES_TO_SKIP = page * moviesPerPage;
        // Use the cursor to only return the movies that belong on the current page
        const displayCursor = cursor.skip(MOVIES_TO_SKIP).limit(moviesPerPage);

        try {
            const moviesList = await displayCursor.toArray()
            const totalNumMovies = page === 0 ? await movies.countDocuments(query) : 0

            return { moviesList, totalNumMovies }
        } catch (e) {
            console.log(`Unable to convert cursor to array or problem counting documents, ${e}`);
            return { moviesList: [], totalNumMovies: 0 };
        }
    }

    /**
     * Finds and returns movies originating from one or more countries.
     * Returns a list of objects, each object contains a title and an _id.
     * @param {string[]} countries - The list of countries.
     * @returns {Promise<CountryResult>} A promise that will resolve to a list of CountryResults. 
     */
    static async getMoviesByCountry(countries) {

        let cursor;
        const query = { countries: { $in: countries } };
        const projection = { title: 1 }; // _id is returned by default unless explicitly excluded
        const opts = { projection };

        try {
            cursor = await movies.find(query, opts);
        } catch (e) {
            console.log(`Unable to issue find command, ${e}`);
            return [];
        }

        return cursor.toArray();
    }

    /**
     * 
     * @param {Object} filters - The search parameter to use in the query. Comes
     * in the form of `{cast: { $in: [...castMembers]}}`
     * @param {number} page - The page of movies to retrieve.
     * @param {number} moviesPerPage - The number of movies to display per page.
     * @returns {FacetedSearchReturn} FacetedSearchReturn
     */
    static async facetedSearch({ filters = null, page = 0, moviesPerPage = 20 } = {}) {
        if (!filters || !filters.cast) {
            throw new Error('Must specify cast members to filter by.');
        }

        const matchStage = { $match: filters };
        const sortStage = { $sort: { 'tomatoes.viewer.rating': -1 } };
        const countingPipeline = [matchStage, sortStage, { $count: 'count' }];
        const skipStage = { $skip: moviesPerPage * page };
        const limitStage = { $limit: moviesPerPage };
        const facetStage = {
            $facet: {
                runtime: [
                    {
                        $bucket: {
                            groupBy: '$runtime',
                            boundaries: [0, 60, 90, 120, 180],
                            default: 'other',
                            output: {
                                count: { $sum: 1 },
                            },
                        },
                    },
                ],
                rating: [
                    {
                        $bucket: {
                            groupBy: '$metacritic',
                            boundaries: [0, 50, 70, 90, 100],
                            default: 'other',
                            output: {
                                count: { $sum: 1 },
                            },
                        },
                    },
                ],
                movies: [
                    {
                        $addFields: {
                            title: '$title',
                        },
                    },
                ],
            },
        };

        let queryPipeline = [
            matchStage,
            sortStage,
            skipStage,
            limitStage,
            facetStage
        ];

        try {
            const results = await (await movies.aggregate(queryPipeline)).next();
            const count = await (await movies.aggregate(countingPipeline)).next();

            return {
                ...results,
                ...count
            };
        } catch (e) {
            return { error: 'Results too large, be more restrictive in filter' };
        }
    }

    /**
     * Gets a movie by its id
     * @param {string} id - The desired movie id, the _id in Mongo
     * @returns {MflixMovie | null} Returns either a single movie or nothing
     */
    static async getMovieByID(id) {
        try {
            const pipeline = [
                {
                    // Find the _id from our movies collection
                    $match: {
                        _id: ObjectId(id),
                    },
                },
                {
                    $lookup: {
                        // We want to find all comments that have the same ID as our movie
                        from: 'comments',
                        // Create a local variable "id" which is set to our original "_id" variable in our $match stage
                        let: { id: '$_id' },
                        pipeline: [
                            {
                                // Find all documents in the comments collection where the movie_id matches our local variable "id"
                                $match: {
                                    $expr: {
                                        $eq: ['$movie_id', '$$id']
                                    },
                                },
                            },
                            {
                                // Sort the comments so that the most recent ones are first (descending order)
                                $sort: {
                                    date: -1,
                                },
                            },
                        ],
                        as: 'comments',
                    },
                },
            ];

            return await movies.aggregate(pipeline).next();
        } catch (e) {
            // Ticket: Error Handling
            // Catch the InvalidId error by string matching, and then handle it.
            if ((e.MongoError = "E11000 duplicate key error collection")) {
                return null;
            }
            console.log(`Something went wrong in getMovieByID: ${e}`);
            throw e;
        }
    }



    /**
     * Finds and returns movies matching a given text in their title or description.
     * @param {string} text - The text to match with.
     * @returns {QueryParams} The QueryParams for text search
     */
    static textSearchQuery(text) {
        const query = { $text: { $search: text } };
        const metaScore = { $meta: "textScore" };
        const sort = [["score", metaScore]];
        const project = { score: metaScore };

        return { query, project, sort };
    }

    /**
     * Finds and returns movies including one or more cast members.
     * @param {string[]} cast - The cast members to match with.
     * @returns {QueryParams} The QueryParams for cast search
     */
    static castSearchQuery(cast) {
        const searchCast = Array.isArray(cast) ? cast : Array(cast);

        const query = { cast: { $in: searchCast } };
        const project = {};
        const sort = DEFAULT_SORT;

        return { query, project, sort };
    }

    /**
     * Finds and returns movies matching a one or more genres.
     * @param {string[]} genre - The genres to match with.
     * @returns {QueryParams} The QueryParams for genre search
     */
    static genreSearchQuery(genre) {
        // Ticket: Text and Subfield Search
        // Given an array of one or more genres, construct a query that searches
        // MongoDB for movies with that genre.
        const searchGenre = Array.isArray(genre) ? genre : Array(genre);

        const query = { genres: { $in: searchGenre } };
        const project = {};
        const sort = DEFAULT_SORT;

        return { query, project, sort };
    }
}

module.exports = MoviesDAO;