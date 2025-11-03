import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const CRITERIA_TERMS = {
  VL: [0.0, 0.0, 0.1],
  L: [0.0, 0.1, 0.3],
  ML: [0.1, 0.3, 0.5],
  M: [0.3, 0.5, 0.7],
  MH: [0.5, 0.7, 0.9],
  H: [0.7, 0.7, 1.0],
  VH: [0.9, 1.0, 1.0],
};

const ALT_TERMS = {
  VP: [0.0, 0.0, 0.1],
  P: [0.0, 0.1, 0.3],
  MP: [0.1, 0.3, 0.5],
  F: [0.3, 0.5, 0.7],
  MG: [0.5, 0.7, 0.9],
  G: [0.7, 0.7, 1.0],
  VG: [0.9, 1.0, 1.0],
};

const CRITERIA_OPTIONS = Object.keys(CRITERIA_TERMS);
const ALT_OPTIONS = Object.keys(ALT_TERMS);

const addTri = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulTriScalar = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const divTriScalar = (a, s) => [a[0] / s, a[1] / s, a[2] / s];

const defuzz = (tri) => (tri[0] + tri[1] + tri[2]) / 3;

export default function App() {
  const [numAlternatives, setNumAlternatives] = useState(4);
  const [numCriteria, setNumCriteria] = useState(5);
  const [numExperts, setNumExperts] = useState(4);

  const [criteriaWeights, setCriteriaWeights] = useState(() => {
    const arr = [];
    for (let e = 0; e < numExperts; e++) {
      const row = [];
      for (let j = 0; j < numCriteria; j++) row.push("M");
      arr.push(row);
    }
    return arr;
  });

  const [altEvaluations, setAltEvaluations] = useState(() => {
    const arr = [];
    for (let e = 0; e < numExperts; e++) {
      const altBlock = [];
      for (let a = 0; a < numAlternatives; a++) {
        const critRow = [];
        for (let j = 0; j < numCriteria; j++) critRow.push("F");
        altBlock.push(critRow);
      }
      arr.push(altBlock);
    }
    return arr;
  });

  const resizeMatrixes = (na, nc, ne) => {
    setCriteriaWeights((prev) => {
      const res = [];
      for (let e = 0; e < ne; e++) {
        const row = [];
        for (let j = 0; j < nc; j++) row.push((prev[e] && prev[e][j]) || "M");
        res.push(row);
      }
      return res;
    });
    setAltEvaluations((prev) => {
      const res = [];
      for (let e = 0; e < ne; e++) {
        const altBlock = [];
        for (let a = 0; a < na; a++) {
          const critRow = [];
          for (let j = 0; j < nc; j++)
            critRow.push((prev[e] && prev[e][a] && prev[e][a][j]) || "F");
          altBlock.push(critRow);
        }
        res.push(altBlock);
      }
      return res;
    });
  };

  const updateCounts = (na, nc, ne) => {
    setNumAlternatives(na);
    setNumCriteria(nc);
    setNumExperts(ne);
    resizeMatrixes(na, nc, ne);
  };

  const handleCriteriaTerm = (eIdx, j, val) => {
    setCriteriaWeights((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[eIdx]) copy[eIdx] = [];
      copy[eIdx][j] = val;
      return copy;
    });
  };

  const handleAltTerm = (eIdx, aIdx, j, val) => {
    setAltEvaluations((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (!copy[eIdx]) copy[eIdx] = [];
      if (!copy[eIdx][aIdx]) copy[eIdx][aIdx] = [];
      copy[eIdx][aIdx][j] = val;
      return copy;
    });
  };

  // --- Core Fuzzy ARAS computations ---
  // 1) Aggregate experts' criteria weights into fuzzy numbers (by averaging triangle corners)
  const aggregatedCriteria = useMemo(() => {
    // returns array of length numCriteria: [l,m,u]
    const K = numExperts;
    const result = [];
    for (let j = 0; j < numCriteria; j++) {
      let sum = [0, 0, 0];
      for (let e = 0; e < numExperts; e++) {
        const term =
          criteriaWeights[e] && criteriaWeights[e][j]
            ? criteriaWeights[e][j]
            : "M";
        const tri = CRITERIA_TERMS[term];
        sum = addTri(sum, tri);
      }
      result.push(divTriScalar(sum, K));
    }
    return result;
  }, [criteriaWeights, numCriteria, numExperts]);

  // 2) Aggregate alternatives evaluations across experts -> matrix A: alt x criteria (triangular numbers)
  const aggregatedAlts = useMemo(() => {
    const K = numExperts;
    const res = [];
    for (let a = 0; a < numAlternatives; a++) {
      const row = [];
      for (let j = 0; j < numCriteria; j++) {
        let sum = [0, 0, 0];
        for (let e = 0; e < numExperts; e++) {
          const term =
            (altEvaluations[e] &&
              altEvaluations[e][a] &&
              altEvaluations[e][a][j]) ||
            "F";
          const tri = ALT_TERMS[term];
          sum = addTri(sum, tri);
        }
        row.push(divTriScalar(sum, K));
      }
      res.push(row);
    }
    return res;
  }, [altEvaluations, numAlternatives, numCriteria, numExperts]);

  const optimalCriteria = useMemo(() => {
    const res = [];
    for (let j = 0; j < numCriteria; j++) {
      let maxL = -Infinity,
        maxM = -Infinity,
        maxU = -Infinity;
      for (let a = 0; a < numAlternatives; a++) {
        const tri = aggregatedAlts[a][j];
        if (!tri) continue;
        if (tri[0] > maxL) maxL = tri[0];
        if (tri[1] > maxM) maxM = tri[1];
        if (tri[2] > maxU) maxU = tri[2];
      }
      // If no alternatives, fallback to aggregatedCriteria
      if (!isFinite(maxL)) {
        res.push(aggregatedCriteria[j]);
      } else {
        res.push([maxL, maxM, maxU]);
      }
    }
    return res;
  }, [aggregatedAlts, aggregatedCriteria, numAlternatives, numCriteria]);

  const normalizedMatrix = useMemo(() => {
    const res = [];
    for (let a = 0; a < numAlternatives; a++) {
      const row = [];
      for (let j = 0; j < numCriteria; j++) {
        const triA = aggregatedAlts[a][j];
        const triOpt = optimalCriteria[j];
        const nn = [
          triOpt[0] === 0 ? 0 : triA[0] / triOpt[0],
          triOpt[1] === 0 ? 0 : triA[1] / triOpt[1],
          triOpt[2] === 0 ? 0 : triA[2] / triOpt[2],
        ];
        row.push(nn);
      }
      res.push(row);
    }
    return res;
  }, [aggregatedAlts, optimalCriteria, numAlternatives, numCriteria]);

  const weightedNormalized = useMemo(() => {
    const res = [];
    for (let a = 0; a < numAlternatives; a++) {
      const row = [];
      for (let j = 0; j < numCriteria; j++) {
        const normTri = normalizedMatrix[a][j];
        const wTri = aggregatedCriteria[j];

        const prod = [
          normTri[0] * wTri[0],
          normTri[1] * wTri[1],
          normTri[2] * wTri[2],
        ];
        row.push(prod);
      }
      res.push(row);
    }
    return res;
  }, [normalizedMatrix, aggregatedCriteria, numAlternatives, numCriteria]);

  const utilitiesFuzzy = useMemo(() => {
    const res = [];
    for (let a = 0; a < numAlternatives; a++) {
      let sum = [0, 0, 0];
      for (let j = 0; j < numCriteria; j++) {
        sum = addTri(sum, weightedNormalized[a][j]);
      }
      res.push(sum);
    }
    return res;
  }, [weightedNormalized, numAlternatives, numCriteria]);

  const utilitiesCrisp = useMemo(
    () => utilitiesFuzzy.map((t) => defuzz(t)),
    [utilitiesFuzzy]
  );

  const optimalityDegrees = useMemo(() => {
    const maxU = Math.max(...utilitiesCrisp);
    if (!isFinite(maxU) || maxU === 0) return utilitiesCrisp.map(() => 0);
    return utilitiesCrisp.map((u) => u / maxU);
  }, [utilitiesCrisp]);

  const chartData = utilitiesCrisp.map((val, idx) => ({
    name: `Alt ${idx + 1}`,
    value: +val.toFixed(4),
    degree: +optimalityDegrees[idx].toFixed(4),
  }));

  const loadSample = () => {
    const sampleCriteria = [
      ["M", "MH", "H", "M", "L"],
      ["MH", "M", "H", "MH", "M"],
      ["M", "M", "H", "M", "L"],
      ["H", "MH", "MH", "M", "M"],
    ];
    const sampleAlts = [];
    for (let e = 0; e < 4; e++) {
      const alts = [];
      alts.push(["F", "MG", "G", "MP", "F"]);
      alts.push(["MG", "G", "G", "MG", "F"]);
      alts.push(["MP", "F", "MG", "MP", "MP"]);
      alts.push(["G", "G", "VG", "G", "MG"]);
      sampleAlts.push(alts);
    }
    setCriteriaWeights(sampleCriteria);
    setAltEvaluations(sampleAlts);
  };

  const renderCriteriaTable = () => {
    return (
      <div className="overflow-auto">
        <table className="table-auto border-collapse w-full text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Expert</th>
              {Array.from({ length: numCriteria }).map((_, j) => (
                <th key={j} className="border px-2 py-1">
                  C{j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numExperts }).map((_, e) => (
              <tr key={e}>
                <td className="border px-2 py-1">E{e + 1}</td>
                {Array.from({ length: numCriteria }).map((_, j) => (
                  <td className="border px-2 py-1" key={j}>
                    <select
                      value={
                        (criteriaWeights[e] && criteriaWeights[e][j]) || "M"
                      }
                      onChange={(ev) =>
                        handleCriteriaTerm(e, j, ev.target.value)
                      }
                      className="w-full p-1"
                    >
                      {CRITERIA_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAltTables = () => {
    return (
      <div className="space-y-4">
        {Array.from({ length: numExperts }).map((_, e) => (
          <div key={e} className="p-2 border rounded">
            <div className="font-semibold mb-2">Expert E{e + 1}</div>
            <div className="overflow-auto">
              <table className="table-auto w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">Alt</th>
                    {Array.from({ length: numCriteria }).map((_, j) => (
                      <th className="border px-2 py-1" key={j}>
                        C{j + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: numAlternatives }).map((_, a) => (
                    <tr key={a}>
                      <td className="border px-2 py-1">A{a + 1}</td>
                      {Array.from({ length: numCriteria }).map((_, j) => (
                        <td className="border px-2 py-1" key={j}>
                          <select
                            value={
                              (altEvaluations[e] &&
                                altEvaluations[e][a] &&
                                altEvaluations[e][a][j]) ||
                              "F"
                            }
                            onChange={(ev) =>
                              handleAltTerm(e, a, j, ev.target.value)
                            }
                            className="w-full p-1"
                          >
                            {ALT_OPTIONS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 w-full flex justify-center flex-col ">
      <h1 className="text-2xl font-bold mb-4">Fuzzy ARAS </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 border rounded">
          <label className="block text-sm">Alternatives</label>
          <input
            type="number"
            min={1}
            value={numAlternatives}
            onChange={(e) =>
              updateCounts(
                Math.max(1, +e.target.value),
                numCriteria,
                numExperts
              )
            }
            className="w-full p-2 mt-1"
          />
        </div>
        <div className="p-4 border rounded">
          <label className="block text-sm">Criteria</label>
          <input
            type="number"
            min={1}
            value={numCriteria}
            onChange={(e) =>
              updateCounts(
                numAlternatives,
                Math.max(1, +e.target.value),
                numExperts
              )
            }
            className="w-full p-2 mt-1"
          />
        </div>
        <div className="p-4 border rounded">
          <label className="block text-sm">Experts</label>
          <input
            type="number"
            min={1}
            value={numExperts}
            onChange={(e) =>
              updateCounts(
                numAlternatives,
                numCriteria,
                Math.max(1, +e.target.value)
              )
            }
            className="w-full p-2 mt-1"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 hidden">
        <button onClick={loadSample} className="px-3 py-2  text-black rounded">
          Load sample
        </button>
        <button
          onClick={() => {
            setCriteriaWeights(criteriaWeights);
            setAltEvaluations(altEvaluations);
          }}
          className="px-3 py-2 bg-gray-200 rounded"
        >
          Recompute
        </button>
      </div>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">1) Критерії </h2>
        {renderCriteriaTable()}
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">2) Оцінки експертів</h2>
        {renderAltTables()}
      </section>

      <section className="mb-6">
        <h3 className="font-semibold mb-2">3) Матриця агрегованих оцінок</h3>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Alt</th>
                {Array.from({ length: numCriteria }).map((_, j) => (
                  <th className="border px-2 py-1" key={j}>
                    C{j + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numAlternatives }).map((_, aIdx) => (
                <tr key={aIdx}>
                  <td className="border px-2 py-1 font-medium text-center">
                    A{aIdx + 1}
                  </td>
                  {Array.from({ length: numCriteria }).map((_, cIdx) => {
                    const terms = Array.from({ length: numExperts }).map(
                      (_, eIdx) =>
                        (altEvaluations[eIdx] &&
                          altEvaluations[eIdx][aIdx] &&
                          altEvaluations[eIdx][aIdx][cIdx]) ||
                        "—"
                    );
                    return (
                      <td key={cIdx} className="border px-2 py-1 text-center">
                        [{terms.join(", ")}]
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-6">
        <h3 className="font-semibold mb-2">
          4) Перетворення ЛТ в трикутні числа по критеріям
        </h3>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Experts</th>
                {Array.from({ length: numCriteria }).map((_, j) => (
                  <th className="border px-2 py-1" key={j}>
                    C{j + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numExperts }).map((_, eIdx) => (
                <tr key={eIdx}>
                  <td className="border px-2 py-1 font-medium text-center">
                    E{eIdx + 1}
                  </td>
                  {Array.from({ length: numCriteria }).map((_, cIdx) => {
                    const term = criteriaWeights[eIdx]?.[cIdx] || "M";
                    const tri = CRITERIA_TERMS[term] || [0, 0, 0];
                    return (
                      <td key={cIdx} className="border px-2 py-1 text-center">
                        [{tri.join(",")}]
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>


      <section className="mb-6">
        <h3 className="font-semibold mb-2">
          5) Перетворення ЛТ в трикутні числа по альтернативам
        </h3>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Alt</th>
                {Array.from({ length: numCriteria }).map((_, j) => (
                  <th className="border px-2 py-1" key={j}>
                    C{j + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numAlternatives }).map((_, aIdx) => (
                <tr key={aIdx}>
                  <td className="border px-2 py-1 font-medium text-center">
                    A{aIdx + 1}
                  </td>
                  {Array.from({ length: numCriteria }).map((_, cIdx) => {

                    const values = Array.from({ length: numExperts }).map(
                      (_, eIdx) => {
                        const term =
                          altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F";
                        return ALT_TERMS[term] || [0, 0, 0];
                      }
                    );
                    return (
                      <td key={cIdx} className="border px-2 py-1 text-center">
                        [{values.map(v => `[${v.join(",")}]`).join(", ")}]
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-6">
        <h2 className="font-semibold mb-2">6) Матриця нечітких чисел по критеріям для всіх експертів</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterion</th>
                <th className="border px-2 py-1">Optimal [l,m,u]</th>
                <th className="border px-2 py-1">Defuzzified</th>
              </tr>
            </thead>
            <tbody>
              {optimalCriteria.map((tri, j) => (
                <tr key={j}>
                  <td className="border px-2 py-1">C{j + 1}</td>
                  <td className="border px-2 py-1">[{tri.map((v) => v.toFixed(4)).join(", ")}]</td>
                  <td className="border px-2 py-1">{defuzz(tri).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>




      {/* <section className="mb-6">
        <h2 className="font-semibold mb-2">3) Aggregated fuzzy criteria (averaged across experts)</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterion</th>
                <th className="border px-2 py-1">[l, m, u]</th>
                <th className="border px-2 py-1">Defuzzified</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedCriteria.map((tri, j) => (
                <tr key={j}>
                  <td className="border px-2 py-1">C{j + 1}</td>
                  <td className="border px-2 py-1">[{tri.map((v) => v.toFixed(4)).join(", ")}]</td>
                  <td className="border px-2 py-1">{defuzz(tri).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">4) Aggregated alternatives fuzzy matrix</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Alt \ Crit</th>
                {Array.from({ length: numCriteria }).map((_, j) => <th key={j} className="border px-2 py-1">C{j + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {aggregatedAlts.map((row, a) => (
                <tr key={a}>
                  <td className="border px-2 py-1">A{a + 1}</td>
                  {row.map((tri, j) => (
                    <td key={j} className="border px-2 py-1">[{tri.map((v) => v.toFixed(4)).join(",")} ]</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">5) Optimal criteria (max across alternatives)</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterion</th>
                <th className="border px-2 py-1">Optimal [l,m,u]</th>
                <th className="border px-2 py-1">Defuzzified</th>
              </tr>
            </thead>
            <tbody>
              {optimalCriteria.map((tri, j) => (
                <tr key={j}>
                  <td className="border px-2 py-1">C{j + 1}</td>
                  <td className="border px-2 py-1">[{tri.map((v) => v.toFixed(4)).join(", ")}]</td>
                  <td className="border px-2 py-1">{defuzz(tri).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">6) Normalized & Weighted normalized matrix</h2>
        <div className="overflow-auto">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Alt</th>
                {Array.from({ length: numCriteria }).map((_, j) => <th key={j} className="border px-2 py-1">C{j + 1}</th>)}
                <th className="border px-2 py-1">Sum fuzzy</th>
                <th className="border px-2 py-1">Crisp utility</th>
              </tr>
            </thead>
            <tbody>
              {weightedNormalized.map((row, a) => (
                <tr key={a}>
                  <td className="border px-2 py-1">A{a + 1}</td>
                  {row.map((tri, j) => (
                    <td key={j} className="border px-2 py-1">[{tri.map((v) => v.toFixed(4)).join(",")} ]</td>
                  ))}
                  <td className="border px-2 py-1">[{utilitiesFuzzy[a].map((v) => v.toFixed(4)).join(",")} ]</td>
                  <td className="border px-2 py-1">{utilitiesCrisp[a].toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">7) Ranking & Optimality degree</h2>
        <div className="overflow-auto mb-4">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Alt</th>
                <th className="border px-2 py-1">Utility (crisp)</th>
                <th className="border px-2 py-1">Degree (relative)</th>
              </tr>
            </thead>
            <tbody>
              {utilitiesCrisp.map((u, a) => (
                <tr key={a} className="">
                  <td className="border px-2 py-1">A{a + 1}</td>
                  <td className="border px-2 py-1">{u.toFixed(4)}</td>
                  <td className="border px-2 py-1">{optimalityDegrees[a].toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section> */}
    </div>
  );
}
