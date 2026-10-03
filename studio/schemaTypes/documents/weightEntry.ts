import {defineField, defineType} from 'sanity'
import {ActivityIcon} from '@sanity/icons/Activity'

export const weightEntry = defineType({
  name: 'weightEntry',
  title: 'Weight',
  type: 'document',
  icon: ActivityIcon,
  fields: [
    defineField({name: 'date', title: 'Date', type: 'date', validation: (rule) => rule.required()}),
    defineField({
      name: 'weightKg',
      title: 'Weight (kg)',
      type: 'number',
      validation: (rule) => rule.required().positive().max(100),
    }),
    defineField({
      name: 'bodyConditionScore',
      title: 'Body condition score (1 to 9)',
      type: 'number',
      validation: (rule) => rule.integer().min(1).max(9),
    }),
    defineField({name: 'note', title: 'Note', type: 'text', rows: 2}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Date, newest first', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]}],
  preview: {
    select: {kg: 'weightKg', date: 'date'},
    prepare: ({kg, date}) => ({title: `${kg} kg`, subtitle: date}),
  },
})
