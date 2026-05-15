const CALENDAR_CONFIG = {
  density: 'rich',
  filter: 'all',
  first_day_of_week: 0,
  heading: 'Calendar',
  show_filter_chips: true,
  view: 'month',
};

export default function CalendarPageApp() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section
        className="section section-events-calendar block-events-calendar block-events-calendar--view-month block-events-calendar--density-rich"
        data-section-scope="page"
        data-section-zone="main"
      >
        <div className="w-full" data-block-hydrate="events_calendar" data-config={JSON.stringify(CALENDAR_CONFIG)}>
          <h2 className="block-events-calendar__heading">Calendar</h2>
          <div className="block-events-calendar__skeleton">
            <div className="event-skeleton-card skeleton" />
            <div className="event-skeleton-card skeleton" />
            <div className="event-skeleton-card skeleton" />
            <div className="event-skeleton-card skeleton" />
          </div>
        </div>
      </section>
    </div>
  );
}
