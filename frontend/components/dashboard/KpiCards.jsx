/** Renders the dashboard's minimum KPI card set (S5 API Contract). */
export default function KpiCards({ cards }) {
  return (
    <ul aria-label="KPI cards">
      {cards.map((card) => (
        <li key={card.name}>
          <h3>{card.name}</h3>
          <p data-testid={`kpi-${card.name}`}>{card.value === null ? "—" : card.value}</p>
          <p>{card.description}</p>
        </li>
      ))}
    </ul>
  );
}
