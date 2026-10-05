import unittest,tempfile
from datetime import date,datetime
from pathlib import Path
from unittest.mock import patch
from showtimes import updater,storage

def rows(week,movies,schedule='Πέμ.-Τετ.: 21.00'):
    return [dict(movie=m,movieSourceUrl=None,cinema='C'+str(i%7),screen=None,programmeDate=week,date=week,time='21:00',rawSchedule=schedule,weekStart=week) for i,m in enumerate(movies)]
OLD=[f'Film {i}' for i in range(60)]

class UpdaterTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.db=storage.connect(self.tmp.name+'/t.sqlite');self.report=Path(self.tmp.name)/'r.json'
    def tearDown(self):
        self.db.close();self.tmp.cleanup()
    def attempt(self,today,parsed,issues=()):
        with patch.object(updater.athinorama,'parse',side_effect=lambda html,week:(rows(week,parsed),list(issues),['C'])),patch.object(updater.athinorama,'cinema_info',return_value={}):
            return updater.run(self.db,today=today,html='',report=self.report)

    def test_thursday(self):
        self.assertEqual(updater.programme_thursday(date(2026,10,6)),date(2026,10,1))
        self.assertEqual(updater.programme_thursday(date(2026,10,8)),date(2026,10,8))
        self.assertEqual(updater.programme_thursday(date(2026,10,7)),date(2026,10,1))
    def test_first_import(self):
        r=self.attempt(date(2026,10,6),OLD)
        self.assertEqual((r['status'],r['weekStart']),('saved','2026-10-01'))
    def test_unchanged_page_on_thursday_is_not_stored_as_new_week(self):
        self.attempt(date(2026,10,6),OLD)
        r=self.attempt(date(2026,10,8),OLD)
        self.assertEqual(r['status'],'not-updated')
        self.assertEqual(storage.week(self.db)['weekStart'],'2026-10-01')
        self.assertIn('νέας εβδομάδας',storage.status(self.db)[0]['error'])
    def test_new_week_is_stored(self):
        self.attempt(date(2026,10,6),OLD)
        r=self.attempt(date(2026,10,8),OLD[:40]+[f'New {i}' for i in range(20)])
        self.assertEqual((r['status'],r['weekStart'],r['new']),('saved','2026-10-08',True))
        self.assertEqual(storage.week(self.db)['showtimes'][0]['programmeDate'],'2026-10-08')
        self.assertIsNone(storage.status(self.db)[0]['error'])
    def test_mid_week_refresh_and_early_next_week(self):
        self.attempt(date(2026,10,5),OLD)
        self.assertEqual(self.attempt(date(2026,10,6),OLD[:58]+['Edit 1','Edit 2'])['status'],'saved')
        r=self.attempt(date(2026,10,7),[f'Next {i}' for i in range(60)])
        self.assertEqual(r['status'],'suspicious')
        self.assertIn('Edit 1',{x['movie'] for x in storage.week(self.db)['showtimes']})
    def test_failure_keeps_data(self):
        self.attempt(date(2026,10,6),OLD)
        self.assertEqual(self.attempt(date(2026,10,6),OLD,issues=[{}]*6)['status'],'failed')
        self.assertEqual(len(storage.week(self.db)['showtimes']),60)
    def test_due(self):
        tz=updater.TZ
        self.assertTrue(updater.due(self.db,datetime(2026,10,6,10,30,tzinfo=tz)))
        self.assertFalse(updater.due(self.db,datetime(2026,10,6,23,0,tzinfo=tz)))
        self.attempt(date(2026,10,6),OLD)
        checked=datetime.fromisoformat(storage.status(self.db)[0]['checkedAt']).astimezone(tz)
        self.assertFalse(updater.due(self.db,checked.replace(hour=11)))  # already ran today
        self.assertTrue(updater.due(self.db,datetime(2026,10,8,9,30,tzinfo=tz)))  # new week expected

if __name__=='__main__':unittest.main()
