import { FieldSchema, FormSchema } from "./FormTypes";

interface EventSchema {
  id: string;
  subtitle: string;
  image: Resource;
  formSchema: FormSchema;
}

interface Resource {
  uri: string;
}

const HIKE_EVENT: EventSchema = {
  id: "HIKE",
  subtitle: "Plan a visit to the trails.",
  image: {
    "uri": "https://res.cloudinary.com/wow-your-client/image/upload/c_scale,w_550/v1582556921/ScoutTrek/hiking_trip.png"
  },
  "formSchema": {
    id: "hikeForm",
    title: "Hike Planning",
    "fields": [
      {
        type: "text",
        id: "title",
        title: "Hike Title"
      }, {
        type: "location",
        id: "location",
        title: "Location"
      }, {
        type: "options",
        id: "uniqueMeetLocation",
        title: "Where do you want everyone to meet?",
        options: [
          {
            id: "trail",
            title: "The trail."
          }, {
            id: "other",
            title: "A different meet point.", 
            hiddenFields: [
              {
                type: "location",
                id: "meetLocation",
                title: "Meet Location",
                subtitle: "Where should everyone meet?"
              }, {
                type: "time",
                id: "meetTime",
                title: "Meet Time",
                subtitle: "What time should everybody get to your meet place?"
              },
              {
                type: "time",
                id: "leaveTime",
                title: "Leave Time",
                subtitle: "What time do you plan to leave your meet place?"
              }
            ]
          }
        ]
      }, {
        type: "date",
        id: "date",
        title: "Date",
        subtitle: "When is your hike?"
      }, {
        type: "time",
        id: "startTime",
        title: "Time",
        subtitle: "What time should everybody be at the trailhead?"
      }, {
        type: "time",
        id: "endTime",
        title: "End Time",
        subtitle: "Around what time will you return from the hike?"
      }, {
        type: "text",
        id: "description",
        title: "Description",
        subtitle: "What additional information do you want everyone to know about this hike?"
      }
    ]
  }
}

export const EVENT_SCHEMAS: EventSchema[] = [HIKE_EVENT]