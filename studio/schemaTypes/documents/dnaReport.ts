import {defineArrayMember, defineField, defineType} from 'sanity'
import {BlockElementIcon} from '@sanity/icons/BlockElement'

/**
 * What a consumer dog DNA test says about him. A genetic test is not a diagnosis, and this document records results as the report
 * states them. Kit numbers, swab numbers and personal report links are never stored here.
 */
export const dnaReport = defineType({
  name: 'dnaReport',
  title: 'DNA report',
  type: 'document',
  icon: BlockElementIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'testDate', title: 'Test date', type: 'date', validation: (rule) => rule.required()}),
    defineField({name: 'provider', title: 'Test', type: 'string', description: 'The kind of test, for example "a consumer DNA test (Embark)". No kit or swab numbers.'}),
    defineField({
      name: 'breedMix',
      title: 'Breed mix',
      type: 'array',
      of: [defineArrayMember({type: 'object', name: 'breedShare', fields: [defineField({name: 'breed', type: 'string'}), defineField({name: 'percent', type: 'number'})], preview: {select: {title: 'breed', subtitle: 'percent'}}})],
    }),
    defineField({name: 'predictedAdultWeightLb', title: 'Predicted adult weight (lb)', type: 'number'}),
    defineField({name: 'increasedRiskCount', title: 'Conditions with increased risk', type: 'number'}),
    defineField({name: 'breedRelevantClear', title: 'Breed-relevant results, all clear', type: 'number'}),
    defineField({name: 'otherClear', title: 'Other results, all clear', type: 'number'}),
    defineField({
      name: 'notableClear',
      title: 'Clear results that connect to his care',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'notableGroup',
          fields: [
            defineField({name: 'title', type: 'string'}),
            defineField({name: 'tests', type: 'array', of: [defineArrayMember({type: 'string'})]}),
            defineField({name: 'whyItMatters', type: 'text', rows: 2}),
          ],
          preview: {select: {title: 'title'}},
        }),
      ],
    }),
    defineField({
      name: 'otherResults',
      title: 'Other results, with the report\'s own caveats',
      type: 'array',
      of: [defineArrayMember({type: 'object', name: 'otherResult', fields: [defineField({name: 'title', type: 'string'}), defineField({name: 'result', type: 'string'}), defineField({name: 'note', type: 'text', rows: 2})], preview: {select: {title: 'title', subtitle: 'result'}}})],
    }),
    defineField({name: 'notCovered', title: 'What this report does not cover', type: 'text', rows: 3}),
    defineField({name: 'comparison', title: 'Compared with the guidance (comparing two sources)', type: 'text', rows: 3}),
    defineField({name: 'caveat', title: 'Caveat', type: 'text', rows: 2}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  preview: {select: {title: 'title', subtitle: 'testDate'}},
})
