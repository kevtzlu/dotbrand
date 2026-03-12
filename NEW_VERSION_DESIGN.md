#改版方向

##過去版本問題
1. Low Perceived Value: 
  - 5-Stage Chatbot 像是在做「資料輸入 (Data Entry)」，用戶感覺像在跟客服聊天，不像在使用專業工具。

2. Too Slow: 
  - 流程線性且冗長 (20mins+)，無法在第一時間創造 "Wow Effect"。

3. Price Ceiling: 
  - 聊天機器人只能賣 $50/mo；我們需要賣 $500k/yr 的 Enterprise Solution。

##目標
1. From Chatbot to Command Center: 從「被動問答」轉變為 “主動診斷儀表板”。

2. The "Consultant" Model: 軟體必須像一位資深顧問：
  - 主動抓漏：看完文件直接指出問題（Gap Analysis）> 第一層 WOW EFFECT
  - 提供選項：不問開放式問題，只給 A/B 決策（Strategic Choice）> 第二層 WOW EFFECT
  - 專業輸出：直接生成可簽字的報告（Final Report）> 產品能落地

##改版方向

我們將 5 階段壓縮為 3 大核心步驟，由「對話驅動」改為「數據驅動」：

1. Overview (戰略定錨)
1.1 行為：上傳 PDF -> AI 自動掃描 -> Dashboard 瞬間呈現。
1.2 關鍵功能：
	1.2.1 Auto-Fill: 自動填寫 90% 參數（地點、類型、面積）。
	1.2.2 Strategic Anchor: 只問 5 個關鍵問題（如：工廠類型）。
	1.2.3 Value: 數秒內給出初步估算範圍 (Potential Estimation)。
2. Detail (戰術微調)
2.1 行為：進入詳細數據網格 (Grid View) -> 處理紅色風險項。
2.2 關鍵功能：
	2.2.1 Interactive BOQ: 類似 Excel 的介面，但帶有「信心紅綠燈」。
	2.2.2 Risk & VE Cards: AI 主動彈出「風險警告」或「成本優化建議 (Value Engineering)」。
	2.2.3 Value: 讓用戶感覺在「審核」而非「計算」。
3. Final (報告輸出)
3.1 行為：確認最終數字 -> 下載報告。
3.2 關鍵功能：
	3.2.1 Scenario Summary: 顯示 Hard/Soft Cost 佔比。
	3.2.2 Export: 一鍵生成 PDF (含假設前提) 與 Excel (詳細 BOQ)。
	3.2.3 Value: 完成最後一哩路，交付可投標的文件。


### 介面設計

左邊是 Sidebar，右邊是 Content。
* Sidebar 有兩區塊，分別是：
1. 最上方
  - Logo
2. 中間（button 都是 icon）
  - Create New Project: 點擊後會跳轉到 Upload Files Page
  - Project List: 顯示所有專案列表，點擊後會跳轉到 Project List Page
  - Account Management: 顯示和修改帳號資訊，點擊後會跳轉到 Account Management Page
* Sidebar 要 fixed 在左邊

Content 主要有四個頁面：
1. Upload Files Page: 上傳文件
2. Project List Page: 顯示所有專案列表，點擊其中一個專案後會跳轉到 Project Detail Page
3. Project Detail Page: 
  - 顯示專案詳細資訊和報告
  - 有三個 tab: Overview, Detail, Final
4. Account Management Page: 顯示和修改帳號資訊


### Main Flow
1. 上傳文件，[上傳文件規則](.Docs/UPLOAD_FILES.md)
 - 上傳後，有小動畫依序 shows
  - ✅ Scanning the files
  - ✅ Retrieving data
  - ✅ Inspecting risks
  - ✅ Analyzing risks
  - ✅ Got it!
  - 下方有 button 可以展開看 AI 思考過程
3. 完成後跳轉到 Project Detail Page (Overview Tab)
4. Overview Tab - 初估
  - 顯示 AI 整理出的檔案已知資訊重點記錄在此
    - ⚠️代表信心程度低，此 icon 閃爍是要 GC 確認
    - ✅代表信心程度高，不用閃爍
    - 所有資訊皆可編輯！
      - 要有編輯的紀錄
  - 顯示單靠上傳資料的粗估
  - 畫面右側有側欄是跟 AI 對話的聊天窗
    - AI 會根據已上傳的資料，看還有缺什麼資訊，去問問題[問題列表](.Docs/OVERVIEW_QUESTIONS.md)，並且根據問題的答案，去更新並儲存已知資訊
      - 問的問題，回答的答案以及影響的欄位要儲存並紀錄在畫面上
      - 更新已知資訊後，要顯示在畫面上
      - 問題要在五個問題內問完
      - 要給選項讓使用者選擇，也提供其他選項讓使用者輸入
    - AI 問完問題後，顯示 button 讓使用者移動到 Detail Tab
5. Detail Tab - 細估，處理風險、硬軟成本比、大項目價格編輯
  - 總共有 5 個區塊
    1. 顯示基於 Overview 確認的答案生成 Monte Carlo 的三個答案，CONSERVATIVE, MID PRICE, OPTIMISTIC，選擇其中一個答案後，**第 4 區塊**會秀出基於 3 個估出的價格所分類的 CSI 價格

    2. 截選出 TOP 5 最高風險的因素。點擊各個 Risk 會展開該 rick 的描述內容：Probability: HIGH / Cost: +$3M-$8M / Impact: Engage structural engineer early; confirm BRB scope in SD phase
    3. Hard cost & Soft cost 比例，可以做調整，調整方式是拉 bar 調整比例。
      SOFT COST 比例如：
      - TI 辦公室裝修項目為 8-12%
      - Cleanroom 無塵室工程依複雜度為 10-20% 範圍
      - Industrial 工業建築維持 5-10% 較低比例
      - 調整後，不會影響 **第 1 區塊**，但是 **第 4 區塊** 會隨之變動
    4. 基於前面確認資訊直接估價 (CSI Div) 
      - 表格數字可以編輯，修改後會連動上面數字
      - 點選表格除了編輯還要提供一個 “? icon” 當 User 點擊 “?” 後，右邊的 (**第 5 區塊**) 會提供解釋這個數字怎麼來的：
        a. Source 資料來源
        b. Benchmark: 為何是這個價格？
        c. 提醒 GC 如果不同意，可以點擊 “鉛筆” icon 修改價格
      - Confidence: 信心度高 - 綠燈、信心度低 - 紅燈，點擊紅燈後會有 tool tips 描述為何 confidence low 
    5. 一開始會有兩個列表呈現 AI 的猜測和 實證過程這兩個 tables
      - 當 User 點擊猜測列表的某個項目後，會展開該項目的詳細內容
  - 有一個確認區塊，User 可以確認估價結果，確認後跳轉到 Final Tab

6. Final Tab - 終價，軟硬成本比調整、大項目確認、下載報告書
  - 有 4 個區塊
    1. 軟硬成本，總共有 3 格，呈現出 Hard Cost + Soft Cost = Total Cost
    2. 軟硬成本比調整，可以拉 bar 調整比例，會影響 **第 1 區塊** 和 **第 3 區塊**
    3. 各項目的 COST SUMMARY，column 有 cost category, HQ Building, AASC Building, Total, $/SF, Confidence，點選其中一個項目後，會展開該項目的詳細內容，也可以進行修改
    4. AI 會特別提：檢查過後如果都沒問題，點擊 DOWNLOAD button 即可下載。
      可以下載兩個檔案形式：
      4.1 PDF 採報告形式檔案列出專案規格、風險、assumption、validation & 最終的 COST Summary 列表 (CSI Div.)
      4.2 EXCEL 把最終的報表下載下來即可