import {defineArrayMember, defineField, defineType} from 'sanity'
import {TagIcon} from '@sanity/icons/Tag'

export const condition = defineType({
  name: 'condition',
  title: 'Condition',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'Active, being managed', value: 'active'},
          {title: 'Resolved', value: 'resolved'},
          {title: 'Monitoring', value: 'monitoring'},
        ],
        layout: 'radio',
      },
    }),
    defineField({name: 'summary', title: 'Plain-language summary', type: 'text', rows: 3}),
    defineField({name: 'diagnosedOn', title: 'Diagnosed on', type: 'date'}),
    defineField({name: 'resolvedOn', title: 'Resolved on', type: 'date'}),
    defineField({
      name: 'monitoredTests',
      title: 'Tests that matter for this condition',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'labTest'}]})],
    }),
    defineField({
      name: 'vetPlan',
      title: "Vet's plan (as documented)",
      type: 'text',
      rows: 4,
      description:
        "What the specialist decided. The app checks against this plan and never replaces it.",
    }),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  preview: {select: {title: 'title', subtitle: 'status'}},
})
