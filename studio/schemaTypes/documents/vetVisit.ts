import {defineArrayMember, defineField, defineType} from 'sanity'
import {CalendarIcon} from '@sanity/icons/Calendar'

export const vetVisit = defineType({
  name: 'vetVisit',
  title: 'Vet visit',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({name: 'date', title: 'Date', type: 'date', validation: (rule) => rule.required()}),
    defineField({
      name: 'visitType',
      title: 'Visit type',
      type: 'string',
      options: {
        list: [
          {title: 'Specialist first consult', value: 'specialist-consult'},
          {title: 'Specialist recheck', value: 'specialist-recheck'},
          {title: 'Technician visit', value: 'technician-visit'},
          {title: 'Procedure', value: 'procedure'},
          {title: 'Emergency', value: 'emergency'},
          {title: 'Imaging', value: 'imaging'},
          {title: 'Drop-off diagnostics', value: 'diagnostics'},
          {title: 'Primary care', value: 'primary-care'},
          {title: 'Nutrition consult', value: 'nutrition-consult'},
        ],
      },
    }),
    defineField({
      name: 'specialty',
      title: 'Specialty',
      type: 'string',
      description: 'For example "Internal medicine". Do not enter clinic or doctor names.',
    }),
    defineField({name: 'summary', title: 'Summary', type: 'text', rows: 4}),
    defineField({
      name: 'diagnoses',
      title: 'Diagnoses and problems listed',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({name: 'medicationChanges', title: 'Medication changes', type: 'text', rows: 3}),
    defineField({
      name: 'recommendations',
      title: 'Recommendations',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
    }),
    defineField({name: 'nextRecheck', title: 'Next recheck', type: 'string'}),
    defineField({name: 'source', title: 'Source', type: 'sourceNote'}),
  ],
  orderings: [{title: 'Date, newest first', name: 'dateDesc', by: [{field: 'date', direction: 'desc'}]}],
  preview: {
    select: {title: 'visitType', subtitle: 'date'},
  },
})
