import { useNavigate } from 'react-router-dom';

export default function SmallValueAssetsLetter() {
  const nav = useNavigate();
  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => nav('/reference/letters')}
        className="mb-6 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to KVS Letters
      </button>

      {/* Letter Paper */}
      <div
        className="bg-white shadow-lg rounded-lg p-12 my-2 border border-gray-100"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        {/* Letterhead */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-300">
          <div className="flex items-center gap-4">
            {/* KVS Logo placeholder (emblem) */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🏛️</span>
            </div>
            <div className="text-sm leading-relaxed text-gray-700">
              <div className="text-xs text-gray-500">केन्द्रीयविद्यालयसंगठन मु./</div>
              <div className="font-bold text-base">Kendriya Vidyalaya Sangathan (HQ)</div>
              <div className="text-xs">18संस्थागतक्षेत्र18/Institutional Area,</div>
              <div className="text-xs">शहीदजीतसिंहमार्ग/Shaheed Jeet Singh Marg,</div>
              <div className="text-xs">नईदिल्ली/110016 – New Delhi -110016</div>
              <div className="text-xs">दूरभाष/Telephone No.: 011-26858570</div>
              <div className="text-xs">Email- budget.section@kvs.gov.in</div>
            </div>
          </div>
        </div>

        {/* File No & Date */}
        <div className="flex justify-between text-sm font-bold mb-8">
          <div>F. No. 110116/2014-15/AA(i)/KVS/Acctts</div>
          <div>Date : 08.12.2021</div>
        </div>

        {/* Addressee */}
        <div className="text-sm mb-6 leading-relaxed">
          <p>Deputy Commissioner/Director</p>
          <p>All Regional Offices/ZIETs</p>
          <p>Kendriya Vidyalaya Sangathan</p>
        </div>

        {/* Subject */}
        <div className="text-sm font-bold mb-6">
          <span>Subject :- </span>
          <span>Providing of 100% depreciation on Small Value Assets –reg.</span>
        </div>

        {/* Salutation */}
        <div className="text-sm mb-4">
          <p>Madam/Sir,</p>
        </div>

        {/* Body */}
        <div className="text-sm leading-relaxed space-y-4 text-justify">
          <p className="indent-8">
            With reference to the subject cited above, it is stated that while certifying the Annual Accounts of KVS for the year 2020-21, the C&AG has made the following observations in Separate Audit Report of KVS for the year 2020-21.
          </p>

          <blockquote className="border-l-4 border-gray-400 pl-5 py-2 ml-4 text-gray-700 italic">
            "As per Notes &amp; Instruction for compilation of Financial Statements of Central Education Institutions prescribed by Ministry of Education (Shiksha Mantralaya), Assets, the individual value of each of which is Rs. 2000 or less (except Library Books) are treated as Small Value Assets, 100% depreciation should be provided in respect of such assets at the time of their acquisition. However physical accounting and control are continued by the holders of such assets. KVS has not shown separately assets costing less than of Rs 2000/- under Small Value Assets which required to be depreciated at 100%. This has resulted in overstatement of Fixed Assets to that extent."
          </blockquote>

          <p className="indent-8">
            Keeping in view the above said observations, it has been decided that from the Financial Year 2021-22, all the KVs/units shall provide 100% depreciation on Small Value Assets (except Library Books) in the year of purchase itself. In other words, depreciation is not required to be calculated on such fixed assets, the individual value of which is up to Rs. 2000. The expenditure incurred on such assets needs to be booked under 'Revenue Expenditure" which will form part of Income and Expenditure Account.
          </p>

          <p className="indent-8">
            It is further stated that 'Significant Accounting Policies' relating to Fixed Assets and Depreciation as shown at serial number 4 in Schedule 23 of Annual Accounts has also been modified to this extent. The existing 'Significant Accounting Policies' relating to Fixed Assets and Depreciation mentioned at serial number 4 of Schedule-23 needs to be replaced with the modified 'Significant Accounting Policies' annexed with this letter..
          </p>

          <p className="indent-8">
            The contents of this letter may be circulated for necessary compliance by all the KVs/units under your jurisdiction. All the Deputy Commissioners/Directors should ensure that Annual Accounts from the financial year 2021-22 onwards have been prepared as per the aforesaid notes and instructions.
          </p>
        </div>

        {/* Encl + Sign */}
        <div className="flex justify-between mt-12">
          <div className="text-sm">Encl : As above</div>
          <div className="text-sm text-right">
            <p className="mb-8">Yours sincerely</p>
            <p className="font-bold">(S.N Gulia)</p>
            <p>Joint Commissioner (Fin.)</p>
          </div>
        </div>

        {/* Annexure — Schedule 23 Clause 4 */}
        <div className="mt-12 border-t-2 border-gray-300 pt-8">
          <h2 className="text-sm font-bold text-center mb-6 uppercase tracking-wide">
            Annexure — Revised Significant Accounting Policy (Schedule 23, Clause 4)
          </h2>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border border-gray-400">
                <td className="border border-gray-400 px-3 py-2 align-top font-bold w-8">4</td>
                <td className="border border-gray-400 px-4 py-4 leading-relaxed text-justify">
                  <p className="mb-4">
                    Depreciation has been provided on the fixed assets in conformity with the principals laid down in Accounting Standard-6 issued by the Institute of Chartered Accountants of India. Written Down Value Method of Depreciation has been applied uniformly on all the fixed assets, except Small Value Assets, having usable life of more than one year. The rate applied for Written Down Value Method for various groups of assets as approved by Board of Governors, KVS are as mentioned below :
                  </p>

                  {/* Rates Table */}
                  <table className="w-full border-collapse text-sm mb-4">
                    <thead>
                      <tr>
                        <th className="border border-gray-400 px-3 py-1.5 text-left font-semibold bg-gray-50">Item</th>
                        <th className="border border-gray-400 px-3 py-1.5 text-center font-semibold bg-gray-50">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Building', '10'],
                        ['Furniture & Fixtures', '10'],
                        ['Library Books', '10'],
                        ['Office Equipments', '15'],
                        ['Vehicles', '15'],
                        ['Computer/Peripherals/Computer Software', '20'],
                        ['Hostel Equipments', '10'],
                        ['Games & Estates', '10'],
                        ['Other Fixed Assets', '10'],
                      ].map(([item, rate]) => (
                        <tr key={item}>
                          <td className="border border-gray-400 px-3 py-1">{item}</td>
                          <td className="border border-gray-400 px-3 py-1 text-center">{rate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="mb-3 text-justify">
                    The depreciation provided in respect of each item of depreciable assets except Small Value Assets, to the extent of 95% of original cost/book value of the depreciable assets keeping residual value to an extent of 5% of the assets. Where during any financial year, addition has been made to assets; the depreciation of such assets is calculated for full financial year irrespective of the date of such addition. Where any asset has been discarded/demolished/destroyed i.e. written off during the year, the original cost of the assets and its accumulated depreciation is written off at the end of the financial year irrespective of the date on which such asset is discarded/demolished/destroyed or written off. The depreciation has been charged on the cost value of the assets. Assets received as gifts are also subject to depreciation after the depiction of face/depreciated value in the Balance Sheet.
                  </p>

                  <p className="text-justify">
                    Assets, the individual value of each of which is Rs. 2000 or less (except Library Books) are treated as Small Value Assets, 100% depreciation is provided in respect of such assets at the time of their acquisition. However physical accounting and control are continued by the holders of such assets
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
