// import dependencies and initialize the express router
const express = require('express');
const MoviesController = require('../controllers/movies-controller');
const CommentsController = require('../controllers/comments-controller');

const router = express.Router();

// define routes
router.route('/').get(MoviesController.apiGetMovies);
router.route('/search').get(MoviesController.apiSearchMovies);
router.route('/countries').get(MoviesController.apiGetMoviesByCountry);
router.route('/facet-search').get(MoviesController.apiFacetedSearch);
router.route('/id/:id').get(MoviesController.apiGetMovieById);
// router.route("/config-options").get(MoviesController.getConfig);

router
  .route('/comment')
  .post(CommentsController.apiPostComment)
  .put(CommentsController.apiUpdateComment)
  .delete(CommentsController.apiDeleteComment)

module.exports = router;