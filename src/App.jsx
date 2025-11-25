import React, { useState, useMemo } from "react";

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
  const CRITERIA_TYPES = ["benefit", "cost"];
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
  const [criteriaTypes, setCriteriaTypes] = useState(() =>
    Array.from({ length: numCriteria }, () => "benefit")
  );
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
    setCriteriaTypes(prev => {
      const res = [];
      for (let j = 0; j < nc; j++) res.push(prev[j] || "benefit");
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

  const aggregatedCriteria = useMemo(() => {
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
      const type = criteriaTypes[j];


      let bestL = type === "benefit" ? -Infinity : Infinity;
      let bestM = type === "benefit" ? -Infinity : Infinity;
      let bestU = type === "benefit" ? -Infinity : Infinity;

      for (let a = 0; a < numAlternatives; a++) {
        const tri = aggregatedAlts[a][j];
        if (!tri) continue;

        const [L, M, U] = tri;

        if (type === "benefit") {
          bestL = Math.max(bestL, L);
          bestM = Math.max(bestM, M);
          bestU = Math.max(bestU, U);
        } else {
          bestL = Math.min(bestL, L);
          bestM = Math.min(bestM, M);
          bestU = Math.min(bestU, U);
        }
      }

      if (!isFinite(bestL)) bestL = 0;
      if (!isFinite(bestM)) bestM = 0;
      if (!isFinite(bestU)) bestU = 0;

      res.push([bestL, bestM, bestU]);
    }

    return res;
  }, [criteriaTypes, aggregatedAlts, numCriteria, numAlternatives]);


  const normalizedMatrix = useMemo(() => {
    const res = [];

    for (let a = 0; a < numAlternatives; a++) {
      const row = [];

      for (let j = 0; j < numCriteria; j++) {
        const A = aggregatedAlts[a][j];
        const Opt = optimalCriteria[j];
        const type = criteriaTypes[j];

        let nL, nM, nU;

        if (type === "benefit") {
          nL = Opt[0] === 0 ? 0 : A[0] / Opt[0];
          nM = Opt[1] === 0 ? 0 : A[1] / Opt[1];
          nU = Opt[2] === 0 ? 0 : A[2] / Opt[2];
        } else {
          nL = A[0] === 0 ? 0 : Opt[0] / A[0];
          nM = A[1] === 0 ? 0 : Opt[1] / A[1];
          nU = A[2] === 0 ? 0 : Opt[2] / A[2];
        }

        row.push([nL, nM, nU]);
      }

      res.push(row);
    }

    return res;
  }, [aggregatedAlts, optimalCriteria, criteriaTypes, numAlternatives, numCriteria]);


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
      <div className="overflow-auto border p-2 rounded">
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
        <div className="mt-3">
          <h3 className="font-semibold mb-1">Типи критеріїв</h3>
          <div className="grid grid-cols-2 gap-2">
            {criteriaTypes.map((t, j) => (
              <div key={j} className="flex items-center gap-2">
                <span>C{j + 1}</span>
                <select
                  value={criteriaTypes[j]}
                  onChange={(e) => {
                    const copy = [...criteriaTypes];
                    copy[j] = e.target.value;
                    setCriteriaTypes(copy);
                  }}
                  className="p-1 border rounded"
                >
                  <option value="benefit">Benefit</option>
                  <option value="cost">Cost</option>
                </select>
              </div>
            ))}
          </div>
        </div>
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

      <div className="flex gap-2 mb-4 ">
        <button onClick={loadSample} className="px-3 py-2  text-black rounded">
          Load sample
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
        <div className="overflow-auto border p-2 rounded">
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
        <div className="overflow-auto border p-2 rounded">
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
        <div className="overflow-auto border p-2 rounded">
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
                        [{values.map((v) => `[${v.join(",")}]`).join(", ")}]
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
        <h2 className="font-semibold mb-2">
          6) Матриця нечітких чисел по критеріям для всіх експертів
        </h2>
        <div className="overflow-auto border p-2 rounded">
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterion</th>
                <th className="border px-2 py-1">l </th>
                <th className="border px-2 py-1">l' </th>
                <th className="border px-2 py-1">m' </th>
                <th className="border px-2 py-1">u'</th>
                <th className="border px-2 py-1">u </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numCriteria }).map((_, j) => {
                const tris = Array.from({ length: numExperts }).map(
                  (__, eIdx) =>
                    CRITERIA_TERMS[criteriaWeights[eIdx]?.[j] || "M"]
                );

                const lMin = Math.min(...tris.map((t) => t[0]));
                const uMax = Math.max(...tris.map((t) => t[2]));
                const lProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[0], 1),
                  1 / numExperts
                );
                const mProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[1], 1),
                  1 / numExperts
                );
                const uProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[2], 1),
                  1 / numExperts
                );

                return (
                  <tr key={j}>
                    <td className="border px-2 py-1 font-medium text-center">
                      C{j + 1}
                    </td>
                    <td className="border px-2 py-1 text-center">{lMin}</td>
                    <td className="border px-2 py-1 text-center">{lProd}</td>
                    <td className="border px-2 py-1 text-center">{mProd}</td>
                    <td className="border px-2 py-1 text-center">{uProd}</td>
                    <td className="border px-2 py-1 text-center">{uMax}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">
          7) Матриця нечітких чисел по критеріям для кожної альтернативи
        </h2>
        <div className="overflow-auto">
          {Array.from({ length: numAlternatives }).map((_, aIdx) => (
            <div key={aIdx} className="mb-4 border p-2 rounded">
              <h3 className="font-medium mb-2">Альтернатива A{aIdx + 1}</h3>
              <table className="table-auto w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">Criterion</th>
                    <th className="border px-2 py-1">l </th>
                    <th className="border px-2 py-1">l' </th>
                    <th className="border px-2 py-1">m'</th>
                    <th className="border px-2 py-1">u'</th>
                    <th className="border px-2 py-1">u </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: numCriteria }).map((_, cIdx) => {
                    const tris = Array.from({ length: numExperts }).map(
                      (_, eIdx) =>
                        ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                    );

                    const lMin = Math.min(...tris.map((t) => t[0]));
                    const uMax = Math.max(...tris.map((t) => t[2]));
                    const lProd = Math.pow(
                      tris.reduce((acc, t) => acc * t[0], 1),
                      1 / numExperts
                    );
                    const mProd = Math.pow(
                      tris.reduce((acc, t) => acc * t[1], 1),
                      1 / numExperts
                    );
                    const uProd = Math.pow(
                      tris.reduce((acc, t) => acc * t[2], 1),
                      1 / numExperts
                    );

                    return (
                      <tr key={cIdx}>
                        <td className="border px-2 py-1 text-center">
                          C{cIdx + 1}
                        </td>
                        <td className="border px-2 py-1 text-center">{lMin}</td>
                        <td className="border px-2 py-1 text-center">
                          {lProd}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {mProd}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {uProd}
                        </td>
                        <td className="border px-2 py-1 text-center">{uMax}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">
          8) Матриця оптимальних значень критеріїв
        </h2>
        <div className="overflow-auto border p-2 rounded">
          <table className="table-auto w-full text-sm border">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterion</th>
                <th className="border px-2 py-1">l</th>
                <th className="border px-2 py-1">l'</th>
                <th className="border px-2 py-1">m'</th>
                <th className="border px-2 py-1">u'</th>
                <th className="border px-2 py-1">u</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numCriteria }).map((_, cIdx) => {
                const type = criteriaTypes[cIdx];

                const trisByAlt = Array.from({ length: numAlternatives }).map(
                  (_, aIdx) => {
                    const expertTris = Array.from({ length: numExperts }).map(
                      (_, eIdx) =>
                        ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                    );

                    const lMin = Math.min(...expertTris.map((t) => t[0]));
                    const lProd = Math.pow(
                      expertTris.reduce((acc, t) => acc * t[0], 1),
                      1 / numExperts
                    );
                    const mProd = Math.pow(
                      expertTris.reduce((acc, t) => acc * t[1], 1),
                      1 / numExperts
                    );
                    const uProd = Math.pow(
                      expertTris.reduce((acc, t) => acc * t[2], 1),
                      1 / numExperts
                    );
                    const uMax = Math.max(...expertTris.map((t) => t[2]));

                    return [lMin, lProd, mProd, uProd, uMax];
                  }
                );


                const lOpt = type === "benefit"
                  ? Math.max(...trisByAlt.map((t) => t[0]))
                  : Math.min(...trisByAlt.map((t) => t[0]));
                const lOptP = type === "benefit"
                  ? Math.max(...trisByAlt.map((t) => t[1]))
                  : Math.min(...trisByAlt.map((t) => t[1]));
                const mOptP = type === "benefit"
                  ? Math.max(...trisByAlt.map((t) => t[2]))
                  : Math.min(...trisByAlt.map((t) => t[2]));
                const uOptP = type === "benefit"
                  ? Math.max(...trisByAlt.map((t) => t[3]))
                  : Math.min(...trisByAlt.map((t) => t[3]));
                const uOpt = type === "benefit"
                  ? Math.max(...trisByAlt.map((t) => t[4]))
                  : Math.min(...trisByAlt.map((t) => t[4]));

                return (
                  <tr key={cIdx}>
                    <td className="border px-2 py-1 text-center">C{cIdx + 1}</td>
                    <td className="border px-2 py-1 text-center">{lOpt.toFixed(5)}</td>
                    <td className="border px-2 py-1 text-center">{lOptP.toFixed(5)}</td>
                    <td className="border px-2 py-1 text-center">{mOptP.toFixed(5)}</td>
                    <td className="border px-2 py-1 text-center">{uOptP.toFixed(5)}</td>
                    <td className="border px-2 py-1 text-center">{uOpt.toFixed(5)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>


      <section className="mb-6">
        <h2 className="font-semibold mb-2">9) Матриця нормованих значень</h2>
        <div className="overflow-auto">
          {Array.from({ length: numCriteria }).map((_, cIdx) => {
            const type = criteriaTypes[cIdx];

            const allAltsTris = Array.from({ length: numAlternatives }).map(
              (_, aIdx) => {
                const tris = Array.from({ length: numExperts }).map(
                  (_, eIdx) =>
                    ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                );

                const lMin = Math.min(...tris.map((t) => t[0]));
                const lProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[0], 1),
                  1 / numExperts
                );
                const mProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[1], 1),
                  1 / numExperts
                );
                const uProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[2], 1),
                  1 / numExperts
                );
                const uMax = Math.max(...tris.map((t) => t[2]));

                return [lMin, lProd, mProd, uProd, uMax];
              }
            );


            const optimalAlt = [0, 1, 2, 3, 4].map((idx) => {
              const vals = allAltsTris.map((t) => t[idx]);
              if (type === "benefit") {
                return Math.max(...vals);
              } else {
                return Math.min(...vals);
              }
            });

            return (
              <div key={cIdx} className="mb-4 border p-2 rounded">
                <h3 className="font-medium mb-2">Criterion {cIdx + 1}</h3>
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1">Alternative</th>
                      {["l", "l'", "m'", "u'", "u"].map((label) => (
                        <th key={label} className="border px-2 py-1">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-100 font-medium">
                      <td className="border px-2 py-1 text-center">Optimal alternative</td>
                      {optimalAlt.map((v, idx) => (
                        <td key={idx} className="border px-2 py-1 text-center">
                          {v.toFixed(5)}
                        </td>
                      ))}
                    </tr>

                    {allAltsTris.map((vals, aIdx) => (
                      <tr key={aIdx}>
                        <td className="border px-2 py-1 text-center">
                          Alternative {aIdx + 1}
                        </td>
                        {vals.map((v, idx) => (
                          <td key={idx} className="border px-2 py-1 text-center">
                            {v.toFixed(5)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>


      <section className="mb-6">
        <h2 className="font-semibold mb-2">10) Нормована зважена матриця</h2>
        <div className="overflow-auto">
          {Array.from({ length: numCriteria }).map((_, cIdx) => {
            const criterionTri = (() => {
              const tris = Array.from({ length: numExperts }).map(
                (_, eIdx) =>
                  CRITERIA_TERMS[criteriaWeights[eIdx]?.[cIdx] || "M"]
              );
              const lMin = Math.min(...tris.map((t) => t[0]));
              const lProd = Math.pow(
                tris.reduce((acc, t) => acc * t[0], 1),
                1 / numExperts
              );
              const mProd = Math.pow(
                tris.reduce((acc, t) => acc * t[1], 1),
                1 / numExperts
              );
              const uProd = Math.pow(
                tris.reduce((acc, t) => acc * t[2], 1),
                1 / numExperts
              );
              const uMax = Math.max(...tris.map((t) => t[2]));
              return [lMin, lProd, mProd, uProd, uMax];
            })();

            const allAltsTris = Array.from({ length: numAlternatives }).map(
              (_, aIdx) => {
                const tris = Array.from({ length: numExperts }).map(
                  (_, eIdx) =>
                    ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                );

                const lMin = Math.min(...tris.map((t) => t[0]));
                const lProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[0], 1),
                  1 / numExperts
                );
                const mProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[1], 1),
                  1 / numExperts
                );
                const uProd = Math.pow(
                  tris.reduce((acc, t) => acc * t[2], 1),
                  1 / numExperts
                );
                const uMax = Math.max(...tris.map((t) => t[2]));
                return [
                  lMin / numCriteria,
                  lProd / numCriteria,
                  mProd / numCriteria,
                  uProd / numCriteria,
                  uMax / numCriteria,
                ];
              }
            );

            const optimalAlt = [
              Math.max(...allAltsTris.map((t) => t[0])),
              Math.max(...allAltsTris.map((t) => t[1])),
              Math.max(...allAltsTris.map((t) => t[2])),
              Math.max(...allAltsTris.map((t) => t[3])),
              Math.max(...allAltsTris.map((t) => t[4])),
            ];

            const weightedAlts = allAltsTris.map((vals) =>
              vals.map((v, idx) => v * criterionTri[idx])
            );

            const weightedOptimal = optimalAlt.map(
              (v, idx) => v * criterionTri[idx]
            );

            return (
              <div key={cIdx} className="mb-4 border p-2 rounded">
                <h3 className="font-medium mb-2">Criterion {cIdx + 1}</h3>
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1">Alternative</th>
                      {["l", "l'", "m'", "u'", "u"].map((label) => (
                        <th key={label} className="border px-2 py-1">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-100 font-medium">
                      <td className="border px-2 py-1 text-center">
                        Optimal alternative
                      </td>
                      {weightedOptimal.map((v, idx) => (
                        <td key={idx} className="border px-2 py-1 text-center">
                          {v.toFixed(5)}
                        </td>
                      ))}
                    </tr>

                    {weightedAlts.map((vals, aIdx) => (
                      <tr key={aIdx}>
                        <td className="border px-2 py-1 text-center">
                          Alternative {aIdx + 1}
                        </td>
                        {vals.map((v, idx) => (
                          <td
                            key={idx}
                            className="border px-2 py-1 text-center"
                          >
                            {v.toFixed(5)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">
          11) Загальна оцінка оптимальності та перетворення матриці нечітких
          чисел в чіткі
        </h2>
        <div className="overflow-auto border p-2 rounded">
          {(() => {
            const altSums = Array.from({ length: numAlternatives }, () => [
              0, 0, 0, 0, 0,
            ]);
            let optimalSum = [0, 0, 0, 0, 0];

            for (let cIdx = 0; cIdx < numCriteria; cIdx++) {
              const tris = Array.from({ length: numExperts }).map(
                (_, eIdx) =>
                  CRITERIA_TERMS[criteriaWeights[eIdx]?.[cIdx] || "M"]
              );
              const lMin = Math.min(...tris.map((t) => t[0]));
              const lProd = Math.pow(
                tris.reduce((acc, t) => acc * t[0], 1),
                1 / numExperts
              );
              const mProd = Math.pow(
                tris.reduce((acc, t) => acc * t[1], 1),
                1 / numExperts
              );
              const uProd = Math.pow(
                tris.reduce((acc, t) => acc * t[2], 1),
                1 / numExperts
              );
              const uMax = Math.max(...tris.map((t) => t[2]));
              const criterionTri = [lMin, lProd, mProd, uProd, uMax];

              const allAltsTris = Array.from({ length: numAlternatives }).map(
                (_, aIdx) => {
                  const trisAlt = Array.from({ length: numExperts }).map(
                    (_, eIdx) =>
                      ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                  );
                  const lMinA = Math.min(...trisAlt.map((t) => t[0]));
                  const lProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[0], 1),
                    1 / numExperts
                  );
                  const mProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[1], 1),
                    1 / numExperts
                  );
                  const uProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[2], 1),
                    1 / numExperts
                  );
                  const uMaxA = Math.max(...trisAlt.map((t) => t[2]));
                  return [
                    lMinA / numCriteria,
                    lProdA / numCriteria,
                    mProdA / numCriteria,
                    uProdA / numCriteria,
                    uMaxA / numCriteria,
                  ];
                }
              );

              const optimalAlt = [
                Math.max(...allAltsTris.map((t) => t[0])),
                Math.max(...allAltsTris.map((t) => t[1])),
                Math.max(...allAltsTris.map((t) => t[2])),
                Math.max(...allAltsTris.map((t) => t[3])),
                Math.max(...allAltsTris.map((t) => t[4])),
              ];

              allAltsTris.forEach((vals, aIdx) => {
                vals.forEach((v, idx) => {
                  altSums[aIdx][idx] += v * criterionTri[idx];
                });
              });

              optimalAlt.forEach((v, idx) => {
                optimalSum[idx] += v * criterionTri[idx];
              });
            }

            const altTotals = altSums.map((arr) =>
              arr.reduce((a, b) => a + b, 0)
            );
            const bestAltIndex = altTotals.indexOf(Math.max(...altTotals));

            return (
              <table className="table-auto w-full text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">Alternative</th>
                    {["Σl", "Σl'", "Σm'", "Σu'", "Σu"].map((label) => (
                      <th key={label} className="border px-2 py-1">
                        {label}
                      </th>
                    ))}
                    <th className="border px-2 py-1">Σ total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-100 font-medium">
                    <td className="border px-2 py-1 text-center">
                      Optimal alternative
                    </td>
                    {optimalSum.map((v, idx) => (
                      <td key={idx} className="border px-2 py-1 text-center">
                        {v.toFixed(5)}
                      </td>
                    ))}
                    <td className="border px-2 py-1 text-center">
                      {optimalSum.reduce((a, b) => a + b, 0).toFixed(5) / 5}
                    </td>
                  </tr>

                  {altSums.map((vals, aIdx) => (
                    <tr key={aIdx}>
                      <td className="border px-2 py-1 text-center">
                        Alternative {aIdx + 1}
                      </td>
                      {vals.map((v, idx) => (
                        <td key={idx} className="border px-2 py-1 text-center">
                          {v.toFixed(5)}
                        </td>
                      ))}
                      <td className="border px-2 py-1 text-center">
                        {altTotals[aIdx].toFixed(5) / 5}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </section>

      <section className="mb-6">
        <h3 className="font-semibold mb-2">
          12) Нормалізовані (чіткі) значення Total
        </h3>
        <div className="overflow-auto border p-2 rounded">
          {(() => {
            const altSums = Array.from({ length: numAlternatives }, () => [
              0, 0, 0, 0, 0,
            ]);
            let optimalSum = [0, 0, 0, 0, 0];

            for (let cIdx = 0; cIdx < numCriteria; cIdx++) {
              const tris = Array.from({ length: numExperts }).map(
                (_, eIdx) =>
                  CRITERIA_TERMS[criteriaWeights[eIdx]?.[cIdx] || "M"]
              );
              const lMin = Math.min(...tris.map((t) => t[0]));
              const lProd = Math.pow(
                tris.reduce((acc, t) => acc * t[0], 1),
                1 / numExperts
              );
              const mProd = Math.pow(
                tris.reduce((acc, t) => acc * t[1], 1),
                1 / numExperts
              );
              const uProd = Math.pow(
                tris.reduce((acc, t) => acc * t[2], 1),
                1 / numExperts
              );
              const uMax = Math.max(...tris.map((t) => t[2]));
              const criterionTri = [lMin, lProd, mProd, uProd, uMax];

              const allAltsTris = Array.from({ length: numAlternatives }).map(
                (_, aIdx) => {
                  const trisAlt = Array.from({ length: numExperts }).map(
                    (_, eIdx) =>
                      ALT_TERMS[altEvaluations[eIdx]?.[aIdx]?.[cIdx] || "F"]
                  );
                  const lMinA = Math.min(...trisAlt.map((t) => t[0]));
                  const lProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[0], 1),
                    1 / numExperts
                  );
                  const mProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[1], 1),
                    1 / numExperts
                  );
                  const uProdA = Math.pow(
                    trisAlt.reduce((acc, t) => acc * t[2], 1),
                    1 / numExperts
                  );
                  const uMaxA = Math.max(...trisAlt.map((t) => t[2]));
                  return [
                    lMinA / numCriteria,
                    lProdA / numCriteria,
                    mProdA / numCriteria,
                    uProdA / numCriteria,
                    uMaxA / numCriteria,
                  ];
                }
              );

              const optimalAlt = [
                Math.max(...allAltsTris.map((t) => t[0])),
                Math.max(...allAltsTris.map((t) => t[1])),
                Math.max(...allAltsTris.map((t) => t[2])),
                Math.max(...allAltsTris.map((t) => t[3])),
                Math.max(...allAltsTris.map((t) => t[4])),
              ];

              allAltsTris.forEach((vals, aIdx) => {
                vals.forEach((v, idx) => {
                  altSums[aIdx][idx] += v * criterionTri[idx];
                });
              });

              optimalAlt.forEach((v, idx) => {
                optimalSum[idx] += v * criterionTri[idx];
              });
            }

            const altTotals = altSums.map(
              (arr) => arr.reduce((a, b) => a + b, 0) / 5
            );
            const optimalTotal = optimalSum.reduce((a, b) => a + b, 0) / 5;
            const bestAltIndex = altTotals.indexOf(Math.max(...altTotals));

            return (
              <>
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1">Alternative</th>
                      <th className="border px-2 py-1">Σ total / Σ optimal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {altTotals.map((total, aIdx) => (
                      <tr
                        key={aIdx}
                        className={
                          aIdx === bestAltIndex
                            ? "bg-green-100 font-semibold"
                            : ""
                        }
                      >
                        <td className="border px-2 py-1 text-center">
                          Alternative {aIdx + 1}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {(total / optimalTotal).toFixed(5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="mt-3 font-medium">
                  Оптимальна альтернатива:&nbsp;
                  <span className="font-bold text-green-700">
                    Альтернатива {bestAltIndex + 1}
                  </span>
                </p>
              </>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
