/*! server.ts
* Copyright (c) 2020 Northwestern University Inclusive Technology Lab */

import { DiagnosticInfo } from "./util/diagnostics";
// import { loadModel } from "./util/classifiers/imageClassifier";
import { sendDiagnostics } from "./util/microservice";
import * as validateDocument from "./validate/validateDocument";
import {
	createConnection,
	DidChangeConfigurationNotification,
	InitializeParams,
	ProposedFeatures,
	TextDocument,
	TextDocuments
} from "vscode-languageserver";

let connection = createConnection(ProposedFeatures.all);
let documents: TextDocuments = new TextDocuments();
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

// Called when the server is connected to
connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	// Initialize classification models
	// loadModel();

	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	};
});

// Called once language server is connected
connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			console.log(_event);
		});
	}
});

// MARK: Default Server Settings

export interface ServerSettings {
	altText: boolean;
	maxNumberOfProblems: number;
	sendDiagnostics: boolean;
	userId: string;
}

const defaultSettings: ServerSettings = {
	altText: true,
	maxNumberOfProblems: 500,
	sendDiagnostics: false,
	userId: "__br_uuid__"
};
let globalSettings: ServerSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ServerSettings>> = new Map();

// Set global settings
connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ServerSettings>(
			(change.settings.bri11iant || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

export function getDocumentSettings(resource: string): Thenable<ServerSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: "bri11iant"
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Handle closing documents
documents.onDidClose((e: { document: { uri: string; }; }) => {
	documentSettings.delete(e.document.uri);
	connection.sendDiagnostics({
		uri: e.document.uri, diagnostics: []
	});
});

// Holds the most recent set of diagnostics
let diagnosticCollection: DiagnosticInfo[] = [];

// Handle document content changing
documents.onDidChangeContent((change: { document: TextDocument; }) => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument) {
	// TODO: Add more document types later
	const diagnostics: DiagnosticInfo[] = await validateDocument.html(textDocument, connection);
	const settings = await getDocumentSettings(textDocument.uri);
	if (settings.sendDiagnostics) {
		sendDiagnostics(diagnostics, diagnosticCollection, settings);
	}
	diagnosticCollection = diagnostics;
}

documents.listen(connection);
connection.listen();
