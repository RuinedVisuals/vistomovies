import unittest,tempfile
from unittest.mock import patch
from pathlib import Path
from showtimes import films,storage
from showtimes.athinorama import version

class FilmsTest(unittest.TestCase):
    def test_exact_match_only(self):
        results=[{'id':1,'title':'Κάτι άλλο','original_title':'Other','vote_count':900},{'id':2,'title':'Ο Νονός','original_title':'The Godfather','vote_count':20000}]
        self.assertEqual(films.pick('Ο ΝΟΝΟΣ',results)['id'],2)
        self.assertEqual(films.pick('The Godfather',results)['id'],2)
        self.assertIsNone(films.pick('Νονός 2',results))
    def test_prefers_recent_remake(self):
        from datetime import date
        y=date.today().year
        results=[{'id':1,'title':'Hope','release_date':'2013-10-02','vote_count':900},{'id':2,'title':'Hope','release_date':f'{y}-05-01','vote_count':40}]
        self.assertEqual(films.pick('Hope',results)['id'],2)
    def test_miss_is_cached(self):
        with tempfile.TemporaryDirectory() as d, patch.object(films,'CACHE',Path(d)/'c.json'), patch.object(films.tmdb,'get',return_value={'results':[]}):
            films._run(['Άγνωστη'])
            self.assertEqual(films.load()['Άγνωστη']['film'],None)
    def test_version(self):
        self.assertEqual(version('Πέμ.-Τετ.: 17.00 (μεταγλ.)'),'dubbed')
        self.assertEqual(version('Πέμ. : 20.00 3D'),'3d')
        self.assertEqual(version('Πέμ. : 20.00'),'subtitled')
    def test_week(self):
        with tempfile.TemporaryDirectory() as d:
            db=storage.connect(d+'/t.sqlite')
            row=lambda day,ws:dict(movie='M',cinema='C',screen=None,date=day,programmeDate=day,time='20:00',weekStart=ws)
            storage.save(db,'x',[row('2026-10-01','2026-10-01'),row('2026-10-07','2026-10-01'),row('2026-10-08','2026-10-08')])
            self.assertEqual(storage.week(db)['weekStart'],'2026-10-08')
            wk=storage.week(db,'2026-10-05')
            self.assertEqual((wk['weekEnd'],len(wk['showtimes'])),('2026-10-07',2))
            self.assertEqual(storage.week(db,'2026-12-01')['showtimes'],[]);db.close()
if __name__=='__main__':unittest.main()
