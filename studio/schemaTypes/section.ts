import {defineField, defineType} from 'sanity'

// A themed section on the site (festival, cycle, special series). Shows at /movies/in/<slug>.
export const section = defineType({
  name: 'section',
  title: 'Ενότητα',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Τίτλος', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'slug', title: 'Slug (URL)', type: 'slug', options: {source: 'title'}, validation: (r) => r.required()}),
    defineField({name: 'description', title: 'Περιγραφή', type: 'text', rows: 3}),
    defineField({
      name: 'films',
      title: 'Ταινίες',
      description: 'Ο τίτλος ακριβώς όπως φαίνεται στην εφαρμογή (όπως τον γράφει το Athinorama).',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'cinemas',
      title: 'Σινεμά',
      description: 'Όλες οι ταινίες που παίζουν σε αυτά τα σινεμά μπαίνουν στην ενότητα (π.χ. για προώθηση ενός σινεμά). Όνομα ακριβώς όπως φαίνεται στην εφαρμογή.',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({name: 'sponsor', title: 'Χορηγός / διοργανωτής', type: 'string'}),
  ],
})
