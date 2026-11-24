import {defineField, defineType} from 'sanity'

// "Ταινία της εβδομάδας": the newest published one is shown at /movies/in/taini-tis-ebdomadas.
export const weeklyPick = defineType({
  name: 'weeklyPick',
  title: 'Ταινία της εβδομάδας',
  type: 'document',
  fields: [
    defineField({
      name: 'film',
      title: 'Ταινία',
      description: 'Ο τίτλος ακριβώς όπως φαίνεται στην εφαρμογή (όπως τον γράφει το Athinorama).',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({name: 'headline', title: 'Σύντομος τίτλος / υπότιτλος', type: 'string'}),
    defineField({name: 'body', title: 'Κείμενο', description: 'Παράγραφοι χωρισμένες με κενή γραμμή.', type: 'text', rows: 10}),
  ],
  preview: {select: {title: 'film', subtitle: 'headline'}},
})
