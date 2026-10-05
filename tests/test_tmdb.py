import unittest
from unittest.mock import patch
from showtimes import tmdb

class TmdbTest(unittest.TestCase):
    def test_parameters(self):
        for query in ({'page':['0']},{'page':['501']},{'category':['bad']}):
            with self.assertRaises(tmdb.ApiError):tmdb.route('/movies',query)
    def test_search(self):
        with patch.object(tmdb,'get',return_value={'results':[]}) as get:
            tmdb.route('/movies',{'query':['Alien'],'page':['2']})
            get.assert_called_once_with('search/movie',query='Alien',page=2,include_adult='false')
    def test_fallback_does_not_mutate_cache(self):
        with patch.object(tmdb,'get',side_effect=[{'overview':''},{'overview':'English summary'}]):
            result=tmdb.route('/movies/11',{})
        self.assertEqual(result['overview'],'English summary')
        self.assertEqual(result['overview_language'],'en')
    def test_invalid_routes(self):
        for path in ['/movies/../account','/movies/0','/movies/foo']:
            with self.assertRaises(tmdb.ApiError):tmdb.route(path,{})
