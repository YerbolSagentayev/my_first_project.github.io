
SELECT 
    c.Id_client,
    COUNT(DISTINCT DATE_FORMAT(t.date_new, '%Y-%m')) AS active_months,
    COUNT(t.Id_check) AS total_operations,
    ROUND(AVG(t.Sum_payment), 2) AS avg_check,
    ROUND(SUM(t.Sum_payment) / 12, 2) AS avg_month_sum,
    ROUND(SUM(t.Sum_payment), 2) AS total_sum
FROM customers c
JOIN transactions t 
  ON c.Id_client = t.ID_client
WHERE t.date_new >= '2015-06-01'
  AND t.date_new <  '2016-06-01'
GROUP BY c.Id_client
HAVING COUNT(DISTINCT DATE_FORMAT(t.date_new, '%Y-%m')) = 12;



WITH monthly_stats AS (
    SELECT
        DATE_FORMAT(t.date_new, '%Y-%m') AS month_key,
        AVG(t.Sum_payment) AS avg_check_month,
        COUNT(t.Id_check) AS total_operations,
        COUNT(DISTINCT t.ID_client) AS unique_clients,
        SUM(t.Sum_payment) AS total_sum
    FROM transactions t
    WHERE t.date_new >= '2015-06-01'
      AND t.date_new <  '2016-06-01'
    GROUP BY DATE_FORMAT(t.date_new, '%Y-%m')
),
gender_stats AS (
    SELECT
        DATE_FORMAT(t.date_new, '%Y-%m') AS month_key,
        c.Gender,
        COUNT(DISTINCT t.ID_client) AS clients_gender,
        SUM(t.Sum_payment) AS sum_gender
    FROM transactions t
    JOIN customers c ON c.Id_client = t.ID_client
    WHERE t.date_new >= '2015-06-01'
      AND t.date_new <  '2016-06-01'
    GROUP BY DATE_FORMAT(t.date_new, '%Y-%m'), c.Gender
)
SELECT 
    ms.month_key,
    ms.avg_check_month,
    ms.total_operations,
    ms.unique_clients,
    ROUND(ms.total_operations * 100.0 / SUM(ms.total_operations) OVER(), 2) AS pct_operations_year,
    ROUND(ms.total_sum * 100.0 / SUM(ms.total_sum) OVER(), 2) AS pct_sum_year,
    gs.Gender,
    ROUND(gs.clients_gender * 100.0 / NULLIF(ms.unique_clients, 0), 2) AS pct_clients_gender,
    ROUND(gs.sum_gender * 100.0 / NULLIF(ms.total_sum, 0), 2) AS pct_sum_gender
FROM monthly_stats ms
LEFT JOIN gender_stats gs ON ms.month_key = gs.month_key
ORDER BY ms.month_key, gs.Gender;



WITH customer_age_group AS (
    SELECT 
        c.Id_client,
        CASE 
            WHEN c.Age IS NULL THEN 'Unknown'
            WHEN c.Age < 10 THEN '0-9'
            WHEN c.Age < 20 THEN '10-19'
            WHEN c.Age < 30 THEN '20-29'
            WHEN c.Age < 40 THEN '30-39'
            WHEN c.Age < 50 THEN '40-49'
            WHEN c.Age < 60 THEN '50-59'
            WHEN c.Age < 70 THEN '60-69'
            ELSE '70+'
        END AS age_group
    FROM customers c
),
trx_with_age AS (
    SELECT 
        t.Id_check,
        t.ID_client,
        t.Sum_payment,
        t.date_new,
        ca.age_group,
        CONCAT(YEAR(t.date_new), '-Q', QUARTER(t.date_new)) AS quarter_key
    FROM transactions t
    JOIN customer_age_group ca ON ca.Id_client = t.ID_client
    WHERE t.date_new >= '2015-06-01'
      AND t.date_new <  '2016-06-01'
),
total_stats AS (
    SELECT 
        age_group,
        SUM(Sum_payment) AS total_sum,
        COUNT(Id_check) AS total_ops
    FROM trx_with_age
    GROUP BY age_group
),
quarter_stats AS (
    SELECT
        age_group,
        quarter_key,
        AVG(Sum_payment) AS avg_check_quarter,
        COUNT(Id_check) AS ops_quarter,
        SUM(Sum_payment) AS sum_quarter
    FROM trx_with_age
    GROUP BY age_group, quarter_key
)
SELECT 
    qs.age_group,
    qs.quarter_key,
    qs.avg_check_quarter,
    qs.ops_quarter,
    ROUND(qs.ops_quarter * 100.0 / SUM(qs.ops_quarter) OVER (PARTITION BY qs.quarter_key), 2) AS pct_ops_quarter,
    ROUND(qs.sum_quarter * 100.0 / SUM(qs.sum_quarter) OVER (PARTITION BY qs.quarter_key), 2) AS pct_sum_quarter,
    ts.total_sum,
    ts.total_ops
FROM quarter_stats qs
JOIN total_stats ts ON ts.age_group = qs.age_group
ORDER BY qs.age_group, qs.quarter_key;

