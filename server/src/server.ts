/*! server.ts
* Copyright (c) 2018 Max van der Schee; Licensed MIT 
* Modified by: 2020 Northwestern University Inclusive Technology Lab */

import * as pattern from './patterns';
import {
	createConnection,
	Diagnostic,
	DiagnosticSeverity,
	DidChangeConfigurationNotification,
	InitializeParams,
	ProposedFeatures,
	TextDocument,
	TextDocuments
} from 'vscode-languageserver';

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments = new TextDocuments();
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface ServerSettings {
	maxNumberOfProblems: number;
	semanticExclude: boolean;
}

const defaultSettings: ServerSettings = { maxNumberOfProblems: 100, semanticExclude: false };
let globalSettings: ServerSettings = defaultSettings;
let documentSettings: Map<string, Thenable<ServerSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = <ServerSettings>(
			(change.settings.webAccessibility || defaultSettings)
		);
	}

	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ServerSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'bri11iant'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidClose((e: { document: { uri: string; }; }) => {
	documentSettings.delete(e.document.uri);
	connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});


documents.onDidChangeContent((change: { document: TextDocument; }) => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let settings = await getDocumentSettings(textDocument.uri);
	let text = textDocument.getText();
	let problems = 0;
	let m: RegExpExecArray | null;
	let diagnostics: Diagnostic[] = [];

	while ((m = pattern.pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		if (m !== null) {
			let el = m[0].slice(0, 5);
			connection.console.log(el);
			switch (true) {
				// ID
				// case (/id="/i.test(el)):
				// 	let resultId = await pattern.validateId(m);
				// 	if (resultId) {
				// 		problems++;
				// 		_diagnostics(resultId.meta, resultId.mess);
				// 	}
				// 	break;
				// Div
				case (/<div/i.test(el)):
					if (settings.semanticExclude === false) {
						let resultDiv = await pattern.validateDiv(m);
						if (resultDiv) {
							problems++;
							_diagnostics(resultDiv.meta, resultDiv.mess, resultDiv.severity);
						}
					}
					break;
				// Span
				case (/<span/i.test(el)):
					if (settings.semanticExclude === false) {
						let resultSpan = await pattern.validateSpan(m);
						if (resultSpan) {
							problems++;
							_diagnostics(resultSpan.meta, resultSpan.mess, resultSpan.severity);
						}
					}
					break;
				// Links
				case (/<a\s/i.test(el)):
					let resultA = await pattern.validateA(m);
					if (resultA) {
						problems++;
						_diagnostics(resultA.meta, resultA.mess, resultA.severity);
					}
					break;
				// Images
				case (/<img/i.test(el)):
					let resultImg = await pattern.validateImg(m);
					if (resultImg) {
						problems++;
						_diagnostics(resultImg.meta, resultImg.mess, resultImg.severity);
					}
					break;
				// input
				case (/<inpu/i.test(el)):
					let resultInput = await pattern.validateInput(m);
					if (resultInput) {
						problems++;
						_diagnostics(resultInput.meta, resultInput.mess, resultInput.severity);
					}
					break;
				// Head, title and meta
				case (/<head/i.test(el)):
					if (/<meta(?:.+?)viewport(?:.+?)>/i.test(m[0])) {
						let resultMeta = await pattern.validateMeta(m);
						if (resultMeta) {
							problems++;
							_diagnostics(resultMeta.meta, resultMeta.mess, resultMeta.severity);
						}
					}
					if (!/<title>/i.test(m[0]) || /<title>/i.test(m[0])) {
						let resultTitle = await pattern.validateTitle(m);
						if (resultTitle) {
							problems++;
							_diagnostics(resultTitle.meta, resultTitle.mess, resultTitle.severity);
						}
					}
					break;
				// HTML
				case (/<html/i.test(el)):
					let resultHtml = await pattern.validateHtml(m);
					if (resultHtml) {
						problems++;
						_diagnostics(resultHtml.meta, resultHtml.mess, resultHtml.severity);
					}
					break;
				// Tabindex
				case (/tabin/i.test(el)):
					let resultTab = await pattern.validateTab(m);
					if (resultTab) {
						problems++;
						_diagnostics(resultTab.meta, resultTab.mess, resultTab.severity);
					}
					break;
				// iframe and frame
				case (/(<fram|<ifra)/i.test(el)):
					let resultFrame = await pattern.validateFrame(m);
					if (resultFrame) {
						problems++;
						_diagnostics(resultFrame.meta, resultFrame.mess, resultFrame.severity);
					}
					break;
				default:
					break;
			}
		}
	}

	async function _diagnostics(regEx: RegExpExecArray, diagnosticsMessage: string, severityNumber: number) {
		let severity: DiagnosticSeverity = DiagnosticSeverity.Hint;

		switch (severityNumber) {
			case 1:
				severity = DiagnosticSeverity.Error;
				break;
			case 2:
				severity = DiagnosticSeverity.Warning;
				break;
			case 3:
				severity = DiagnosticSeverity.Information;
				break;
			case 4:
                // Handled in initialization
                break;
		}

		let diagnostic: Diagnostic = {
			severity,
			message: diagnosticsMessage,
			range: {
				start: textDocument.positionAt(regEx.index),
				end: textDocument.positionAt(regEx.index + regEx[0].length),
			},
			code: 0,
			source: 'bri11iant'
		};

		diagnostics.push(diagnostic);
	}
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.listen(connection);

connection.listen();
