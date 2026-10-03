import {defineField, defineType} from 'sanity'
import {ImageIcon} from '@sanity/icons/Image'

export const imagingStudy = defineType({
  name: 'imagingStudy',
  title: 'Imaging study',
  type: 'document',
  icon: ImageIcon,
  fields: [
    defineField({name: 'date', title: 'Date', type: 'date', validation: (rule) => rule.required()}),
    defineField({
      name: 'modality',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'Abdominal ultrasound', value: 'ultrasound'},
          {title: 'CT scan', value: 'ct'},
          {title: 'X-ray', value: 'xray'},
        ],
        layout: 'radio',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'string',
      description: 'One plain line describing the scan itself, for example "CT and liver aspirates normal". Shown as the timeline title.',
    }),
    defineField({name: 'comparison', title: 'Compared with', type: 'string'}),
    defineField({name: 'findings', title: 'Findings (summary)', type: 'text', rows: 5}),
    defineField({name: 'conclusion', title: 'Radiologist conclusion', type: 'text', rows: 3}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Date, newest first', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]}],
  preview: {select: {title: 'modality', subtitle: 'date'}},
})
