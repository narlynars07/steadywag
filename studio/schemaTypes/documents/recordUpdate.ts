import {defineArrayMember, defineField, defineType} from 'sanity'
import {RefreshIcon} from '@sanity/icons/Refresh'

/**
 * One entry in the record's change log: something was added, corrected, flagged or resolved, and who said so.
 * When his vet removes a medication from the written list, the medication is marked stopped, its gap and question are resolved,
 * and an entry like this one is added, so the record always shows what changed and why.
 */
export const recordUpdate = defineType({
  name: 'recordUpdate',
  title: 'Record update',
  type: 'document',
  icon: RefreshIcon,
  fields: [
    defineField({name: 'date', title: 'Date', type: 'date', validation: (rule) => rule.required()}),
    defineField({name: 'title', title: 'What changed', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'summary', title: 'Details', type: 'text', rows: 4}),
    defineField({
      name: 'kind',
      title: 'Kind of change',
      type: 'string',
      options: {
        list: [
          {title: 'Added', value: 'added'},
          {title: 'Corrected', value: 'corrected'},
          {title: 'Flagged (something does not match)', value: 'flagged'},
          {title: 'Resolved', value: 'resolved'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'basis',
      title: 'Who said so',
      type: 'string',
      options: {
        list: [
          {title: 'Confirmed by his vet', value: 'vet'},
          {title: 'Reported by his family', value: 'family'},
          {title: 'From his documents', value: 'documents'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'affects',
      title: 'Records this touched',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'medication'}, {type: 'recordGap'}, {type: 'vetQuestion'}, {type: 'vetVisit'}, {type: 'familyNote'}, {type: 'historyChapter'}, {type: 'careRoutine'}]})],
    }),
  ],
  orderings: [{title: 'Newest first', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]}],
  preview: {select: {title: 'title', subtitle: 'date'}},
})
