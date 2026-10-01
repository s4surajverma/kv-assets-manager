import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function WDVReferenceLetter() {
  const nav = useNavigate();
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <button
        onClick={() => nav('/reference/letters')}
        className="mb-6 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to KVS Letters
      </button>
    <div className="max-w-4xl mx-auto p-8 bg-white shadow rounded my-6" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <div className="flex items-start justify-end mb-8">
        <div className="text-right">
          <h1 className="text-lg font-bold uppercase tracking-tight leading-tight">Kendriya Vidyalaya Sangathan (HQ)</h1>
          <p className="text-sm">18, Institutional Area, S.J. Marg, New Delhi-110016</p>
          <p className="text-sm italic">Email: lekhakvshq@gmail.com</p>
        </div>
      </div>

      <div className="flex justify-between text-sm font-bold mb-6">
        <div>F. No. 110116/2014-15/AA(I)/KVS/Acctts</div>
        <div>Dated 06.06.2016</div>
      </div>

      <div className="text-sm mb-6 leading-relaxed">
        <p>The Deputy Secretary,</p>
        <p>UT2, Section,</p>
        <p>MHRD, Govt. of India,</p>
        <p>Shastri Bhawan, New Delhi.</p>
      </div>

      <div className="text-sm font-bold mb-6 flex gap-4">
        <span className="shrink-0">Sub:</span>
        <span className="underline">Adoption of "Written Down Value Method" of Depreciation in KVS -reg.</span>
      </div>

      <div className="text-sm mb-6">
        <p className="mb-4">Sir,</p>
        <p className="mb-4 indent-8 text-justify">
          With reference to the subject cited above, it is stated that KVS was following the "Straight Line Method" of depreciation prior to the financial year 2011-12. However, from the financial year 2011-12, KVS decided to apply the "Written Down Method"(WDV) of depreciation for calculation of depreciation on all fixed assets with the approval of the Board of Governors of KVS. In fact, KVS has switched over to "WDV" method from "Straight Line Method" due to the following benefits.
        </p>
        
        <ol className="list-[lower-alpha] pl-12 space-y-3 text-justify mb-6">
          <li>Under this method, large portion of cost is written off in the earlier years, loss due to obsolescence gets reduced.</li>
          <li>The Income Tax Act, 1961 allows this method of Depreciation.</li>
          <li>The companies Act 2013 also recognize this method of Depreciation.</li>
          <li>This method is based on the assumption that the benefits of an assets go on diminishing with the passage of time. Hence under this method, there is proper allocation of cost of assets because higher deprecation is charged in the earlier years when the assets utility is more as compared to later years when it becomes less useful.</li>
          <li>This method is suitable for all fixed assets, which lasts for long and require increased Repair and Maintenance expenses with the passage of time.</li>
        </ol>

        <p className="mb-4 text-justify">
          2) As per the directions issued by MHRD, Central Educational Institutions including KVS has to implement the Accounting Standards and new system of accounting from the financial year 2013-14. In compliance, KVS devised the format of Accounts for KVS and obtained the approval of MHRD. Accordingly, Accounts of KVS for the financial year 2013-14 were prepared applying the "WDV" method of depreciation. However on 29th April 2015, again MHRD forwarded the new format of accounts along with guidance notes stating that the Accounts may be submitted in the new format of accounts. Accordingly, KVS modified the existing format of accounts in conformity with the format of accounts forwarded by MHRD.
        </p>

        <p className="mb-4 text-justify">
          3) From the guidance note, it is observed that there is a mention about calculation of depreciation by applying the "Straight Line Method" of depreciation. It is pertinent to mention here that KVS has been following the "WDV" method of depreciation from the year 2011-12 and all the accounting Standards are applicable to KVS. Accounting Standards -6 deals with the "Depreciation Accounting" and basic principles on the subject. The relevant abstract as cited under Paragraph 21 of this standard is reproduced below.
        </p>

        <blockquote className="italic ml-8 border-l-4 border-gray-400 pl-4 py-1 mb-4 text-gray-700 text-justify text-sm">
          "The depreciation method selected should be applied consistently from period to period. A change from one method of providing depreciation to another should be made only if the adoption of the new method is required by statute or for compliance with an accounting standard or if it is considered that the change would result in a more appropriate preparation or presentation of the financial statements of the enterprise. When such a change in the method of depreciation is made, <span className="font-bold text-base underline decoration-gray-400 underline-offset-4">depreciation should be recalculated in accordance with the new method from the date of the asset coming into use.</span> The deficiency or surplus arising from retrospective recomputation of depreciation in accordance with the new method should be adjusted in the accounts in the year in which the method of depreciation is changed. In case the change in the method results in deficiency in depreciation in respect of past years, the deficiency should be charged in the statement of profit and loss. In case the change in the method results in surplus, the surplus should be credited to the statement of profit and loss. Such a change should be treated as a change in accounting policy and its effect should be quantified and disclosed"
        </blockquote>

        <p className="mb-8 text-justify">
          4) In view of the above, it is submitted that change of depreciation method at this stage is neither feasible nor it would be appropriate in preparation and presentation of the financial statements of KVS. It is, therefore, requested that in terms of the benefits explained under para-1 of this letter and the contents of paragraph 21 of the "Accounting Standard -6", KVS may kindly be permitted to follow the existing method namely "Written Down Value" method.
        </p>

        <div className="text-right pb-12 pr-12">
          <p className="mb-8">Yours faithfully,</p>
          <p className="font-bold">(S Muthusivam)</p>
          <p>Deputy Commissioner (Fin)</p>
        </div>
      </div>
    </div>
    </div>
  );
}
