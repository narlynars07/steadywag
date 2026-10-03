import {defineArrayMember, defineField, defineType} from 'sanity'
import {WarningOutlineIcon} from '@sanity/icons/WarningOutline'

/** A period when the dog was unwell: the basis for the good-day and bad-day timeline. */
export const flareEpisode = defineType({
  name: 'flareEpisode',
  title: 'Flare episode',
  type: 'document',
  icon: WarningOutlineIcon,
  fields: [
    defineField({name: 'startDate', title: 'Started', type: 'date', validation: (rule) => rule.required()}),
    defineField({name: 'endDate', title: 'Ended', type: 'date'}),
    defineField({
      name: 'dateApproximate',
      title: 'Start date is approximate',
      type: 'boolean',
      description: 'Turn on when the records give only a month or a rough time, so the site shows "about" before the date.',
      initialValue: false,
    }),
    defineField({
      name: 'severity',
      title: 'Severity',
      type: 'string',
      options: {
        list: [
          {title: 'Mild, managed at home', value: 'mild'},
          {title: 'Moderate', value: 'moderate'},
          {title: 'Severe, emergency care', value: 'severe'},
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'levelOfCare',
      title: 'Care received',
      type: 'string',
      options: {
        list: [
          {title: 'Home care only', value: 'home'},
          {title: 'Vet guidance by phone or email', value: 'vet-guidance'},
          {title: 'Emergency visit', value: 'emergency'},
        ],
      },
    }),
    defineField({
      name: 'signs',
      title: 'Signs noticed',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({name: 'supportiveCare', title: 'Supportive care given', type: 'text', rows: 3}),
    defineField({
      name: 'suspectedCause',
      title: 'Suspected cause (as documented)',
      type: 'string',
      description: 'Only what a vet documented, for example "presumptive pancreatitis".',
    }),
    defineField({name: 'outcome', title: 'Outcome', type: 'text', rows: 2}),
    defineField({
      name: 'conditions',
      title: 'Related conditions',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'condition'}]})],
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Newest first', name: 'startDesc', by: [{field: 'startDate', direction: 'desc'}]}],
  preview: {
    select: {title: 'suspectedCause', subtitle: 'startDate'},
    prepare: ({title, subtitle}) => ({title: title ?? 'Flare episode', subtitle}),
  },
})
