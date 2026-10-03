import {defineArrayMember, defineField, defineType} from 'sanity'
import {PackageIcon} from '@sanity/icons/Package'

const weekdays = [
  {title: 'Monday', value: 'mon'},
  {title: 'Tuesday', value: 'tue'},
  {title: 'Wednesday', value: 'wed'},
  {title: 'Thursday', value: 'thu'},
  {title: 'Friday', value: 'fri'},
  {title: 'Saturday', value: 'sat'},
  {title: 'Sunday', value: 'sun'},
]

export const medication = defineType({
  name: 'medication',
  title: 'Medication',
  type: 'document',
  icon: PackageIcon,
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'genericName', title: 'Generic name', type: 'string'}),
    defineField({
      name: 'dose',
      title: 'Dose',
      type: 'string',
      description: 'As written by the vet, for example "90 mg".',
    }),
    defineField({
      name: 'frequency',
      title: 'Frequency',
      type: 'string',
      description: 'As written by the vet, for example "q24" or "q12" (every 24 or 12 hours).',
    }),
    defineField({
      name: 'days',
      title: 'Days of the week',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      options: {list: weekdays},
      description: 'Leave empty for daily medications.',
    }),
    defineField({
      name: 'timeOfDay',
      title: 'Time of day',
      type: 'string',
      options: {
        list: [
          {title: 'Morning, after breakfast', value: 'morning'},
          {title: 'Evening', value: 'evening'},
          {title: 'Bedtime', value: 'bedtime'},
          {title: 'As needed', value: 'as-needed'},
        ],
      },
    }),
    defineField({name: 'purpose', title: 'Purpose', type: 'string'}),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Active', value: 'active'},
          {title: 'Stopped', value: 'stopped'},
          {title: 'On the vet list but not given', value: 'listed-not-given'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'startDate', title: 'Started', type: 'date'}),
    defineField({name: 'endDate', title: 'Stopped', type: 'date'}),
    defineField({
      name: 'lastConfirmedOn',
      title: 'Last confirmed on the specialist list',
      type: 'date',
      description:
        'The date of the most recent specialist document that listed this medication as current. For an active medication, this is the date its dose and schedule were last verified.',
    }),
    defineField({
      name: 'conditions',
      title: 'Related conditions',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'condition'}]})],
    }),
    defineField({name: 'notes', title: 'Notes', type: 'text', rows: 3}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  preview: {
    select: {title: 'name', dose: 'dose', frequency: 'frequency', status: 'status'},
    prepare: ({title, dose, frequency, status}) => ({
      title,
      subtitle: [dose, frequency, status].filter(Boolean).join(' · '),
    }),
  },
})
