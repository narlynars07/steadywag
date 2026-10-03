import {defineArrayMember, defineField, defineType} from 'sanity'
import {BarChartIcon} from '@sanity/icons/BarChart'

/** A kind of test (ALT, ALKP, triglycerides...). Results point at this. */
export const labTest = defineType({
  name: 'labTest',
  title: 'Lab test',
  type: 'document',
  icon: BarChartIcon,
  fields: [
    defineField({
      name: 'code',
      title: 'Code',
      type: 'string',
      description: 'Short code used on lab reports, for example ALT.',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Liver', value: 'liver'},
          {title: 'Pancreas', value: 'pancreas'},
          {title: 'Fats and cholesterol', value: 'lipids'},
          {title: 'Kidney', value: 'kidney'},
          {title: 'Blood count', value: 'blood-count'},
          {title: 'Electrolytes and proteins', value: 'chemistry'},
          {title: 'Other', value: 'other'},
        ],
      },
    }),
    defineField({name: 'unit', title: 'Usual unit', type: 'string'}),
    defineField({
      name: 'whatItMeasures',
      title: 'What it measures',
      type: 'text',
      rows: 2,
      description: 'Plain language, for owners.',
    }),
    defineField({
      name: 'relevantConditions',
      title: 'Conditions this test helps monitor',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'condition'}]})],
    }),
  ],
  preview: {select: {title: 'code', subtitle: 'name'}},
})
