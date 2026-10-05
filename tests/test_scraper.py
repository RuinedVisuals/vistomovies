import unittest,tempfile
from datetime import date
from showtimes.athinorama import expand,parse
from showtimes import storage
class Tests(unittest.TestCase):
 def test_ranges(self):
  r=expand('Πέμ., Δευτ.-Τετ. : 20.45, Παρ.-Κυρ. 21.10',date(2026,10,1))
  self.assertEqual(len(r),7);self.assertIn(('2026-10-05','20:45'),r);self.assertIn(('2026-10-03','21:10'),r)
 def test_multiple(self):
  self.assertEqual(len(expand('Πέμ.-Σάβ. : 18.20, Κυρ. 13.30/ 18.20, Δευτ.-Τετ. 16.45/ 19.45',date(2026,10,1))),11)
 def test_notes(self):
  self.assertEqual(len(expand('Πέμ.-Τετ. : 21.50, Κυρ. 12.00 (με εισ. 7€)',date(2026,10,1))),8)
 def test_unknown(self):
  for text in ['Πέμ. : 25.00','Πέμ. : 20.00 εκτός αργιών','Καθημερινά 21.00']:
   with self.assertRaises(ValueError):expand(text,date(2026,10,1))
 def test_thursday(self):
  with self.assertRaises(ValueError):parse('', '2026-10-05')
 def test_storage(self):
  with tempfile.TemporaryDirectory() as d:
   db=storage.connect(d+'/test.sqlite');r=dict(movie='Test',cinema='Cinema',screen='1',date='2026-10-05',time='20:00')
   storage.save(db,'test',[r,r]);self.assertEqual(len(storage.read(db)),1)
   storage.save(db,'test',[r]);storage.fail(db,'test','blocked')
   self.assertEqual(len(storage.read(db)),1);self.assertEqual(storage.status(db)[0]['error'],'blocked')
   with self.assertRaises(ValueError):storage.save(db,'test',[])
   self.assertEqual(len(storage.read(db)),1);db.close()
if __name__=='__main__':unittest.main()
