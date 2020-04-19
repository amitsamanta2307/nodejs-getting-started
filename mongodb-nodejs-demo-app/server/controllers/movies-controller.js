'use strict';

const MoviesDAO = require('../models/moviesDAO');

const MOVIES_PER_PAGE = 20

class MoviesController {

    static async apiGetMovies(req, res, next) {

        const { moviesList, totalNumMovies } = await MoviesDAO.getMovies();

        let response = {
            movies: moviesList,
            page: 0,
            filters: {},
            entriesPerPage: MOVIES_PER_PAGE,
            totalResults: totalNumMovies,
        }

        res.status(200).send(response);
    }

    static async apiSearchMovies(req, res, next) {
        let page;
        let searchType;
        let filters = {};

        try {
            page = req.query.page ? parseInt(req.query.page, 10) : 0;
        } catch (e) {
            console.log(`Got bad value for page:, ${e}`);
            page = 0
        }

        try {
            searchType = Object.keys(req.query)[0];
        } catch (e) {
            console.log(`No search keys specified: ${e}`);
        }

        switch (searchType) {
            case 'genre':
                filters.genre = req.query.genre;
                break;

            case 'cast':
                filters.cast = req.query.cast;
                break;

            case 'text':
                filters.text = req.query.text;
                break;

            default:
        }

        const { moviesList, totalNumMovies } = await MoviesDAO.getMovies({
            filters,
            page,
            MOVIES_PER_PAGE,
        });

        let response = {
            movies: moviesList,
            page: page,
            filters,
            entries_per_page: MOVIES_PER_PAGE,
            total_results: totalNumMovies,
        };

        res.status(200).send(response);
    }

    static async apiGetMoviesByCountry(req, res, next) {
        let countries = Array.isArray(req.query.countries)
            ? req.query.countries
            : Array(req.query.countries);

        let moviesList = await MoviesDAO.getMoviesByCountry(countries);

        let response = {
            titles: moviesList
        }

        res.status(200).send(response);
    }

    static async apiFacetedSearch(req, res, next) {
        let page;

        try {
            page = req.query.page ? parseInt(req.query.page, 10) : 0;
        } catch (e) {
            console.log(`Got bad value for page, defaulting to 0: ${e}`);
            page = 0
        }

        if (!req.query.cast) {
            return this.apiSearchMovies(req, res, next);
        }

        const filters = { cast: req.query.cast }

        const facetedSearchResult = await MoviesDAO.facetedSearch({
            filters,
            page,
            MOVIES_PER_PAGE,
        });

        let response = {
            movies: facetedSearchResult.movies,
            facets: {
                runtime: facetedSearchResult.runtime,
                rating: facetedSearchResult.rating,
            },
            page: page,
            filters,
            entries_per_page: MOVIES_PER_PAGE,
            total_results: facetedSearchResult.count,
        };

        res.status(200).send(response);
    }

    static async apiGetMovieById(req, res, next) {
        try {
            let id = req.params.id || {};
            let movie = await MoviesDAO.getMovieByID(id);

            if (!movie) {
                res.status(404).send({ error: 'Not found' })
                return;
            }

            let updatedType = movie.lastupdated instanceof Date ? 'Date' : 'other';
            res.status(200).send({ movie, updatedType });
        } catch (e) {
            console.log(`api, ${e}`);
            res.status(500).send({ error: e });
        }
    }
}

module.exports = MoviesController;